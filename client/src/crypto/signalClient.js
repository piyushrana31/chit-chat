import { setWebCrypto } from '@privacyresearch/libsignal-protocol-typescript';
import { createKeyManager } from './keyManager.js';
import { decryptMessage } from './decryption.js';
import { encryptMessage } from './encryption.js';
import { createSessionManager } from './sessionManager.js';

function apiUrl(apiBaseUrl, path) {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

export async function createSignalClient({ userId, token, apiBaseUrl = 'http://localhost:4000/api', wsUrl = 'ws://localhost:4000/ws', namespace } = {}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is required for Signal sessions');
  }
  setWebCrypto(globalThis.crypto);

  const keyManager = await createKeyManager({ namespace: namespace || `secure-chat:signal:${userId}` });
  const sessionManager = createSessionManager({ store: keyManager.store, localUserId: userId });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const establishedSessions = new Set();

  async function publishKeyBundle() {
    const response = await fetch(apiUrl(apiBaseUrl, '/keys'), {
      method: 'POST',
      headers,
      body: JSON.stringify(keyManager.publicBundle()),
    });
    if (!response.ok) throw new Error(`Key bundle publication failed: ${response.status}`);
    return response.json();
  }

  async function retrieveKeyBundle(remoteUserId) {
    const response = await fetch(apiUrl(apiBaseUrl, `/keys/${encodeURIComponent(remoteUserId)}`), { headers });
    if (!response.ok) throw new Error(`Key bundle retrieval failed: ${response.status}`);
    return response.json();
  }

  async function establishSession(remoteUserId) {
    const bundle = await retrieveKeyBundle(remoteUserId);
    await sessionManager.establishSession(remoteUserId, bundle);
    establishedSessions.add(String(remoteUserId));
    return { remoteUserId: String(remoteUserId), established: true };
  }

  async function encryptFor(remoteUserId, plaintext) {
    const remoteId = String(remoteUserId);
    if (!establishedSessions.has(remoteId)) await establishSession(remoteId);
    return encryptMessage({ sessionManager, remoteUserId: remoteId, plaintext });
  }

  async function decryptFrom(remoteUserId, ciphertext) {
    return decryptMessage({ sessionManager, remoteUserId: String(remoteUserId), ciphertext });
  }

  function connectWebSocket({ onMessage, onStatus } = {}) {
    const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    socket.addEventListener('open', () => onStatus?.('open'));
    socket.addEventListener('close', () => onStatus?.('closed'));
    socket.addEventListener('error', () => onStatus?.('error'));
    socket.addEventListener('message', async (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'MESSAGE_RECEIVED') {
        const plaintext = await decryptFrom(payload.senderId, payload.ciphertext);
        socket.send(JSON.stringify({ type: 'MESSAGE_DELIVERED', messageId: payload.messageId }));
        onMessage?.({ ...payload, plaintext });
      } else {
        onMessage?.(payload);
      }
    });
    return {
      socket,
      sendEncrypted: async (remoteUserId, messageId, plaintext) => {
        const ciphertext = await encryptFor(remoteUserId, plaintext);
        socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId, receiverId: String(remoteUserId), ciphertext }));
        return ciphertext;
      },
      markMessageRead: (messageId) => {
        socket.send(JSON.stringify({ type: 'MESSAGE_READ', messageId }));
      },
    };
  }

  return {
    keyManager,
    sessionManager,
    publishKeyBundle,
    retrieveKeyBundle,
    establishSession,
    encryptFor,
    decryptFrom,
    connectWebSocket,
  };
}
