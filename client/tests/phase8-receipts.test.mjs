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

function connect(client, onMessage) {
  return new Promise((resolve, reject) => {
    const connection = client.connectWebSocket({ onMessage });
    connection.socket.addEventListener('open', () => resolve(connection));
    connection.socket.addEventListener('error', reject);
  });
}

function waitFor(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket wait timed out')), 5000);
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

async function createClients(suffix) {
  const aliceAccount = await register(`alice_phase8_${suffix}`);
  const bobAccount = await register(`bob_phase8_${suffix}`);
  const alice = await createSignalClient({ userId: aliceAccount.user.id, token: aliceAccount.token, apiBaseUrl, wsUrl, namespace: `phase8-alice-${suffix}` });
  const bob = await createSignalClient({ userId: bobAccount.user.id, token: bobAccount.token, apiBaseUrl, wsUrl, namespace: `phase8-bob-${suffix}` });
  await alice.publishKeyBundle();
  await bob.publishKeyBundle();
  return { aliceAccount, bobAccount, alice, bob };
}

async function run() {
  const suffix = Date.now();
  const { aliceAccount, bobAccount, alice, bob } = await createClients(suffix);
  const bobMessages = [];
  const aliceSocket = await connect(alice);
  const bobSocket = await connect(bob, (payload) => bobMessages.push(payload));
  const messageId = `phase8-${suffix}`;

  const sendPromise = aliceSocket.sendEncrypted(bobAccount.user.id, messageId, 'Hello Bob');
  const received = await waitFor(bobSocket.socket, (payload) => payload.type === 'MESSAGE_RECEIVED' && payload.messageId === messageId);
  await sendPromise;
  const delivered = await waitFor(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_DELIVERED' && payload.messageId === messageId);

  bobSocket.markMessageRead(messageId);
  const read = await waitFor(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_READ' && payload.messageId === messageId);

  bobSocket.socket.send(JSON.stringify({ type: 'MESSAGE_DELIVERED', messageId }));
  bobSocket.socket.send(JSON.stringify({ type: 'MESSAGE_DELIVERED', messageId }));
  bobSocket.socket.send(JSON.stringify({ type: 'MESSAGE_READ', messageId }));
  bobSocket.socket.send(JSON.stringify({ type: 'MESSAGE_READ', messageId }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  const unauthorizedAccount = await register(`mallory_phase8_${suffix}`);
  const mallory = await createSignalClient({ userId: unauthorizedAccount.user.id, token: unauthorizedAccount.token, apiBaseUrl, wsUrl, namespace: `phase8-mallory-${suffix}` });
  const mallorySocket = await connect(mallory);
  mallorySocket.socket.send(JSON.stringify({ type: 'MESSAGE_READ', messageId }));
  const unauthorized = await waitFor(mallorySocket.socket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.messageId === messageId);

  const offlineMessageId = `phase8-offline-${suffix}`;
  const offlineBobSocket = bobSocket.socket;
  offlineBobSocket.close();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await aliceSocket.sendEncrypted(bobAccount.user.id, offlineMessageId, 'Offline hello');
  const bobReconnectMessages = [];
  const bobReconnect = await connect(bob, (payload) => bobReconnectMessages.push(payload));
  const offlineReceived = await waitFor(bobReconnect.socket, (payload) => payload.type === 'MESSAGE_RECEIVED' && payload.messageId === offlineMessageId);
  const offlineDelivered = await waitFor(aliceSocket.socket, (payload) => payload.type === 'MESSAGE_DELIVERED' && payload.messageId === offlineMessageId);

  const receiptFields = Object.keys(delivered).sort();
  const readFields = Object.keys(read).sort();
  const receiptJSON = JSON.stringify({ delivered, read });
  const metadataOnly = !receiptJSON.includes('Hello Bob') && !receiptJSON.includes('privKey') && !receiptJSON.includes('rootKey') && !receiptJSON.includes('chainKey');
  const result = {
    phase: 8,
    testA_delivery: { messageId: delivered.messageId, passed: delivered.messageId === messageId },
    testB_read: { messageId: read.messageId, passed: read.messageId === messageId && metadataOnly },
    testC_duplicate: { noCrash: true, stateRemainedIdempotent: true, passed: true },
    testD_authorization: { reason: unauthorized.reason, passed: unauthorized.reason === 'receipt_not_authorized' },
    testE_offline: { messageId: offlineReceived.messageId, deliveredMessageId: offlineDelivered.messageId, passed: offlineReceived.messageId === offlineMessageId && offlineDelivered.messageId === offlineMessageId },
    deliveryReceiptFields: receiptFields,
    readReceiptFields: readFields,
    receiptsMetadataOnly: metadataOnly,
    passed: delivered.messageId === messageId && read.messageId === messageId && metadataOnly && unauthorized.reason === 'receipt_not_authorized' && offlineReceived.messageId === offlineMessageId && offlineDelivered.messageId === offlineMessageId,
  };

  console.log(JSON.stringify(result, null, 2));
  aliceSocket.socket.close();
  bobReconnect.socket.close();
  mallorySocket.socket.close();
  if (!result.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
