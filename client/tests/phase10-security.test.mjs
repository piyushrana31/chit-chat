import { setWebCrypto } from '@privacyresearch/libsignal-protocol-typescript';
import { createKeyManager } from '../src/crypto/keyManager.js';
import { createSessionManager } from '../src/crypto/sessionManager.js';

setWebCrypto(globalThis.crypto);
const API = 'http://localhost:4000';
const WS = 'ws://localhost:4000/ws';

async function register(username) {
  const response = await fetch(`${API}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'TestPass123!' }) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS}?token=${encodeURIComponent(token)}`);
    socket.addEventListener('open', () => resolve(socket));
    socket.addEventListener('error', reject);
  });
}

function waitFor(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test timeout')), 5000);
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
  const aliceAccount = await register(`alice_phase10_${suffix}`);
  const bobAccount = await register(`bob_phase10_${suffix}`);
  const unauthenticated = await fetch(`${API}/api/auth/me`).then((response) => response.status);
  const malformedJwt = await fetch(`${API}/api/auth/me`, { headers: { Authorization: 'Bearer malformed' } }).then((response) => response.status);
  const aliceKeys = await createKeyManager({ namespace: `phase10-alice-${suffix}`, oneTimePreKeyCount: 3 });
  const bobKeys = await createKeyManager({ namespace: `phase10-bob-${suffix}`, oneTimePreKeyCount: 3 });
  const alice = createSessionManager({ store: aliceKeys.store, localUserId: aliceAccount.user.id });
  const bob = createSessionManager({ store: bobKeys.store, localUserId: bobAccount.user.id });
  const bobBundle = bobKeys.publicBundle();
  await alice.establishSession(bobAccount.user.id, { ...bobBundle, preKey: bobBundle.oneTimePreKeys[0] });
  const ciphertexts = [];
  for (const text of ['Message 1', 'Message 2', 'Message 3', '<script>alert(1)</script>']) ciphertexts.push(await alice.encrypt(bobAccount.user.id, text));
  const inOrder = [await bob.decrypt(aliceAccount.user.id, ciphertexts[0]), await bob.decrypt(aliceAccount.user.id, ciphertexts[1]), await bob.decrypt(aliceAccount.user.id, ciphertexts[2])];
  const xssText = await bob.decrypt(aliceAccount.user.id, ciphertexts[3]);
  let replayError = null;
  try { await bob.decrypt(aliceAccount.user.id, ciphertexts[2]); } catch (error) { replayError = { name: error.name, message: error.message }; }

  const aliceSocket = await connect(aliceAccount.token);
  const bobSocket = await connect(bobAccount.token);
  const validMessageId = `phase10-${suffix}`;
  const received = waitFor(bobSocket, (payload) => payload.type === 'MESSAGE_RECEIVED' && payload.messageId === validMessageId);
  aliceSocket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: validMessageId, receiverId: bobAccount.user.id, ciphertext: ciphertexts[3] }));
  const relayed = await received;
  const malformedId = waitFor(aliceSocket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.reason === 'message_id_required');
  aliceSocket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: 'bad id', receiverId: bobAccount.user.id, ciphertext: ciphertexts[0] }));
  const malformedIdResult = await malformedId;
  const invalidType = waitFor(aliceSocket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.reason === 'malformed_ciphertext');
  aliceSocket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: `invalid-type-${suffix}`, receiverId: bobAccount.user.id, ciphertext: { type: 9, body: ciphertexts[0].body } }));
  const invalidTypeResult = await invalidType;
  const duplicate = waitFor(aliceSocket, (payload) => payload.type === 'MESSAGE_ERROR' && payload.reason === 'duplicate_message_id');
  aliceSocket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: validMessageId, receiverId: bobAccount.user.id, ciphertext: ciphertexts[3] }));
  const duplicateResult = await duplicate;
  const oversized = await new Promise((resolve) => {
    const socket = new WebSocket(`${WS}?token=${encodeURIComponent(aliceAccount.token)}`);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'SEND_MESSAGE', messageId: `oversized-${suffix}`, receiverId: bobAccount.user.id, ciphertext: { type: 3, body: 'A'.repeat(300000) } })));
    socket.addEventListener('close', (event) => resolve(event.code));
    socket.addEventListener('error', () => {});
  });
  const unauthSocket = await new Promise((resolve) => {
    const socket = new WebSocket(WS);
    socket.addEventListener('close', (event) => resolve({ code: event.code, reason: event.reason }));
    socket.addEventListener('error', () => {});
  });
  console.log(JSON.stringify({
    phase: 10,
    authentication: { unauthenticated, malformedJwt, unauthenticatedWebSocket: unauthSocket },
    signal: { inOrder, xssText, replayError },
    relay: { hasPlaintextField: Object.prototype.hasOwnProperty.call(relayed, 'text'), hasPrivateMaterial: /privKey|privateKey|rootKey|chainKey|sessionKey/i.test(JSON.stringify(relayed)) },
    validation: { malformedMessageId: malformedIdResult.reason, invalidCiphertextType: invalidTypeResult.reason, duplicateMessageId: duplicateResult.reason, oversizedPayloadCloseCode: oversized },
    passed: unauthenticated === 401 && malformedJwt === 401 && unauthSocket.code === 1008 && unauthSocket.reason === 'Authentication required' && JSON.stringify(inOrder) === JSON.stringify(['Message 1', 'Message 2', 'Message 3']) && xssText === '<script>alert(1)</script>' && replayError?.name === 'MessageCounterError' && !Object.prototype.hasOwnProperty.call(relayed, 'text') && !/privKey|privateKey|rootKey|chainKey|sessionKey/i.test(JSON.stringify(relayed)) && malformedIdResult.reason === 'message_id_required' && invalidTypeResult.reason === 'malformed_ciphertext' && duplicateResult.reason === 'duplicate_message_id' && oversized === 1009,
  }, null, 2));
  aliceSocket.close();
  bobSocket.close();
}

run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
