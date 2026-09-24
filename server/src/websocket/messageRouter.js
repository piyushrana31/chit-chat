import mongoose from 'mongoose';
import MessageMetadata from '../models/MessageMetadata.js';

export async function routeMessage({ message, connectionManager, senderId, receiverId, server, messageIds, pendingMessages }) {
  if (typeof message.messageId !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(message.messageId)) {
    return { ok: false, delivered: false, reason: 'message_id_required', senderId, receiverId };
  }

  if (!/^[a-f\d]{24}$/i.test(String(receiverId))) {
    return { ok: false, delivered: false, reason: 'invalid_receiver', senderId, receiverId };
  }

  if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
    return { ok: false, delivered: false, reason: 'invalid_user', senderId, receiverId };
  }

  if (!message.ciphertext || typeof message.ciphertext.body !== 'string' || message.ciphertext.body.length === 0 || message.ciphertext.body.length > 262144 || !/^[A-Za-z0-9+/]*={0,2}$/.test(message.ciphertext.body) || ![1, 3].includes(message.ciphertext.type)) {
    return { ok: false, delivered: false, reason: 'malformed_ciphertext', senderId, receiverId };
  }

  if (messageIds.has(message.messageId) || await MessageMetadata.exists({ messageId: message.messageId })) {
    return { ok: false, delivered: false, reason: 'duplicate_message_id', senderId, receiverId, messageId: message.messageId };
  }

  const outgoing = {
    ...message,
    senderId,
    receiverId,
    timestamp: new Date().toISOString(),
  };

  try {
    await MessageMetadata.create({
      messageId: message.messageId,
      senderId,
      receiverId,
      ciphertext: JSON.stringify(message.ciphertext),
      status: 'SENT',
    });
  } catch (error) {
    if (error.code === 11000) return { ok: false, delivered: false, reason: 'duplicate_message_id', senderId, receiverId, messageId: message.messageId };
    throw error;
  }

  messageIds.add(message.messageId);
  const targetSocket = connectionManager.getConnection(receiverId);

  if (!targetSocket) {
    pendingMessages.set(String(receiverId), [...(pendingMessages.get(String(receiverId)) || []), outgoing]);
    return {
      ok: false,
      delivered: false,
      reason: 'offline',
      receiverId,
      senderId,
    };
  }

  targetSocket.send(JSON.stringify(outgoing));

  if (server && typeof server.emit === 'function') {
    server.emit('message-routed', { senderId, receiverId, messageId: message.messageId });
  }

  return {
    ok: true,
    delivered: true,
    receiverId,
    senderId,
    messageId: message.messageId,
  };
}
