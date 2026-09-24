import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { routeMessage } from './messageRouter.js';
import { handleReceipt } from './receiptHandler.js';

export function createWebSocketServer({ server, jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me' }) {
  const connectionManager = new ConnectionManager();
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 262144 });
  const messageIds = new Set();
  const pendingMessages = new Map();

  const sendError = (ws, messageId, reason) => {
    ws.send(JSON.stringify({ type: 'MESSAGE_ERROR', messageId, reason }));
  };

  const broadcastPresence = (userId, status) => {
    const payload = {
      type: status ? 'USER_ONLINE' : 'USER_OFFLINE',
      userId,
      timestamp: new Date().toISOString(),
    };

    for (const socket of connectionManager.connections.values()) {
      socket.send(JSON.stringify(payload));
    }
  };

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      const userId = String(decoded.userId);

      connectionManager.addConnection(userId, ws);
      broadcastPresence(userId, true);

      ws.user = decoded;
      ws.send(
        JSON.stringify({
          type: 'SERVER_HELLO',
          message: 'WebSocket connected',
          userId,
          onlineUsers: connectionManager.getOnlineUsers(),
        })
      );

      for (const pending of pendingMessages.get(userId) || []) ws.send(JSON.stringify(pending));
      pendingMessages.delete(userId);

      ws.on('error', () => {});

      ws.on('message', async (raw) => {
        try {
          const payload = JSON.parse(raw.toString());

          if (payload.type === 'SEND_MESSAGE') {
            const result = await routeMessage({
              message: {
                type: 'MESSAGE_RECEIVED',
                messageId: payload.messageId,
                ciphertext: payload.ciphertext,
              },
              connectionManager,
              senderId: userId,
              receiverId: payload.receiverId,
              server: wss,
              messageIds,
              pendingMessages,
            });

            if (result.delivered) {
              ws.send(JSON.stringify({ type: 'MESSAGE_SENT', messageId: payload.messageId }));
            } else if (result.reason === 'offline') {
              ws.send(
                JSON.stringify({
                  type: 'MESSAGE_OFFLINE',
                  messageId: payload.messageId,
                  senderId: userId,
                  receiverId: payload.receiverId,
                  reason: 'offline',
                })
              );
            } else {
              sendError(ws, payload.messageId, result.reason);
            }
          }

          if (payload.type === 'MESSAGE_DELIVERED' || payload.type === 'MESSAGE_READ') {
            const result = await handleReceipt({
              receipt: payload,
              authenticatedUserId: userId,
              connectionManager,
            });
            if (!result.ok) sendError(ws, payload.messageId, result.reason);
          }

          if (payload.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (error) {
          sendError(ws, undefined, error instanceof SyntaxError ? 'malformed_json' : 'message_processing_failed');
        }
      });

      ws.on('close', () => {
        if (connectionManager.removeConnection(userId, ws)) {
          broadcastPresence(userId, false);
        }
      });
    } catch (error) {
      ws.close(1008, 'Invalid or expired token');
    }
  });

  return { wss, connectionManager };
}
