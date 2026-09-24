import { createSignalClient } from '../src/crypto/signalClient.js';

const apiBaseUrl = 'http://localhost:4000/api';
const wsUrl = 'ws://localhost:4000/ws';

async function register(username) {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'TestPass123!' }),
  });
  if (!response.ok) throw new Error(`Registration failed: ${await response.text()}`);
  return response.json();
}

function openSocket(client, options = {}) {
  return new Promise((resolve, reject) => {
    const connection = client.connectWebSocket({
      onMessage: options.onMessage,
      onStatus(status) {
        if (status === 'error') reject(new Error('WebSocket connection failed'));
      },
    });
    connection.socket.addEventListener('open', () => resolve(connection));
    connection.socket.addEventListener('error', reject);
  });
}

function waitForCondition(condition) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - startedAt > 5000) return reject(new Error('Timed out waiting for condition'));
      setTimeout(check, 10);
    };
    check();
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket payload')), 5000);
    const listener = (event) => {
      const payload = JSON.parse(event.data);
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.removeEventListener('message', listener);
        resolve(payload);
      }
    };
    socket.addEventListener('message', listener);
  });
}

async function run() {
  const suffix = Date.now();
  const aliceAccount = await register(`alice_phase7_${suffix}`);
  const bobAccount = await register(`bob_phase7_${suffix}`);
  const alice = await createSignalClient({
    userId: aliceAccount.user.id,
    token: aliceAccount.token,
    apiBaseUrl,
    wsUrl,
    namespace: `phase7-alice-${suffix}`,
  });
  const bob = await createSignalClient({
    userId: bobAccount.user.id,
    token: bobAccount.token,
    apiBaseUrl,
    wsUrl,
    namespace: `phase7-bob-${suffix}`,
  });

  await alice.publishKeyBundle();
  await bob.publishKeyBundle();
  const received = [];
  const aliceSocket = await openSocket(alice);
  const bobSocket = await openSocket(bob, {
    onMessage(payload) {
      if (payload.type === 'MESSAGE_RECEIVED') received.push({ payload, plaintext: payload.plaintext });
    },
  });

  const messages = ['Hello Bob', 'Message 1', 'Message 2', 'Message 3'];
  const ciphertexts = [];
  for (const [index, plaintext] of messages.entries()) {
    ciphertexts.push(await aliceSocket.sendEncrypted(bobAccount.user.id, `phase7-${suffix}-${index}`, plaintext));
    await waitForCondition(() => received.some(({ payload }) => payload.messageId === `phase7-${suffix}-${index}`));
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  const malformedMessageId = `malformed-${suffix}`;
  aliceSocket.socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: malformedMessageId, receiverId: bobAccount.user.id, ciphertext: { type: 3, body: '' } }));
  const malformed = await waitForMessage(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.messageId === malformedMessageId);

  const duplicateMessageId = `phase7-${suffix}-0`;
  aliceSocket.socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: duplicateMessageId, receiverId: bobAccount.user.id, ciphertext: ciphertexts[0] }));
  const duplicate = await waitForMessage(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.messageId === duplicateMessageId);

  const invalidReceiverId = `invalid-${suffix}`;
  aliceSocket.socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: `invalid-${suffix}`, receiverId: invalidReceiverId, ciphertext: ciphertexts[0] }));
  const invalidReceiver = await waitForMessage(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.messageId === `invalid-${suffix}`);

  const offlineReceiverId = '000000000000000000000001';
  aliceSocket.socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: `offline-${suffix}`, receiverId: offlineReceiverId, ciphertext: ciphertexts[0] }));
  const offline = await waitForMessage(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_OFFLINE');

  const privateKeyNames = ['privKey', 'privateKey', 'sessionKey', 'rootKey', 'chainKey'];
  const serverPayloads = received.map(({ payload }) => payload);
  const containsPrivateMaterial = JSON.stringify(serverPayloads).toLowerCase().includes(privateKeyNames.join('|').toLowerCase());
  const containsPlaintextField = serverPayloads.some((payload) => Object.prototype.hasOwnProperty.call(payload, 'text'));
  const decryptedMessages = received.map(({ plaintext }) => plaintext);
  const ciphertextsDiffer = new Set(ciphertexts.map(({ body }) => body)).size === ciphertexts.length;
  const result = {
    phase: 7,
    messageOrderSent: messages,
    messageOrderDecrypted: decryptedMessages,
    ciphertexts: ciphertexts.map(({ type, body }) => ({ type, bodyLength: body.length })),
    relayPayloadContainsPlaintextTextField: containsPlaintextField,
    relayPayloadContainsPrivateMaterial: containsPrivateMaterial,
    ciphertextsDiffer,
    errors: {
      malformedCiphertext: malformed.reason,
      duplicateMessageId: duplicate.reason,
      invalidReceiver: invalidReceiver.reason,
      disconnectedReceiver: offline.reason,
    },
    passed: JSON.stringify(decryptedMessages) === JSON.stringify(messages) && !containsPlaintextField && !containsPrivateMaterial && ciphertextsDiffer && malformed.reason === 'malformed_ciphertext' && duplicate.reason === 'duplicate_message_id' && invalidReceiver.reason === 'invalid_receiver' && offline.reason === 'offline',
  };

  console.log(JSON.stringify(result, null, 2));
  aliceSocket.socket.close();
  bobSocket.socket.close();
  if (!result.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
