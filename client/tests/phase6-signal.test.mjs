import { setWebCrypto } from '@privacyresearch/libsignal-protocol-typescript';
import { createKeyManager } from '../src/crypto/keyManager.js';
import { createSessionManager } from '../src/crypto/sessionManager.js';

setWebCrypto(globalThis.crypto);

async function createPair(label) {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const aliceKeys = await createKeyManager({ namespace: `${suffix}:alice`, oneTimePreKeyCount: 3 });
  const bobKeys = await createKeyManager({ namespace: `${suffix}:bob`, oneTimePreKeyCount: 3 });
  const alice = createSessionManager({ store: aliceKeys.store, localUserId: 'alice' });
  const bob = createSessionManager({ store: bobKeys.store, localUserId: 'bob' });
  const publicBundle = bobKeys.publicBundle();
  const bundleForAlice = { ...publicBundle, preKey: publicBundle.oneTimePreKeys[0] };

  await alice.establishSession('bob', bundleForAlice);
  return { alice, bob };
}

async function encryptMessages(alice, messages) {
  const ciphertexts = [];
  for (const plaintext of messages) ciphertexts.push(await alice.encrypt('bob', plaintext));
  return ciphertexts;
}

function ciphertextSummary(ciphertexts) {
  return ciphertexts.map((ciphertext, index) => ({
    message: index + 1,
    type: ciphertext.type,
    bodyLength: ciphertext.body.length,
  }));
}

async function testInOrder() {
  const { alice, bob } = await createPair('in-order');
  const messages = ['Message 1', 'Message 2', 'Message 3'];
  const ciphertexts = await encryptMessages(alice, messages);
  const decrypted = [];
  for (const ciphertext of ciphertexts) decrypted.push(await bob.decrypt('alice', ciphertext));

  return {
    name: 'Test A',
    sentOrder: ['M1', 'M2', 'M3'],
    decryptedOrder: decrypted,
    ciphertexts: ciphertextSummary(ciphertexts),
    passed: JSON.stringify(decrypted) === JSON.stringify(messages),
  };
}

async function testOutOfOrderAndReplay() {
  const { alice, bob } = await createPair('out-of-order');
  const messages = ['Message 1', 'Message 2', 'Message 3'];
  const ciphertexts = await encryptMessages(alice, messages);
  const receiveOrder = [0, 2, 1];
  const decrypted = [];
  for (const index of receiveOrder) decrypted.push(await bob.decrypt('alice', ciphertexts[index]));

  let replay = { rejected: false, name: null, message: null };
  try {
    await bob.decrypt('alice', ciphertexts[1]);
  } catch (error) {
    replay = { rejected: true, name: error.name, message: error.message };
  }

  return {
    name: 'Test B',
    sentOrder: ['M1', 'M2', 'M3'],
    receivedOrder: ['M1', 'M3', 'M2'],
    decryptedOrder: decrypted,
    ciphertexts: ciphertextSummary(ciphertexts),
    outOfOrderSucceeded: JSON.stringify(decrypted) === JSON.stringify(['Message 1', 'Message 3', 'Message 2']),
    replayRejected: replay.rejected,
    replayError: replay,
    passed: JSON.stringify(decrypted) === JSON.stringify(['Message 1', 'Message 3', 'Message 2']) && replay.rejected,
  };
}

async function testCiphertextDifference() {
  const { alice } = await createPair('different-ciphertexts');
  const ciphertexts = await encryptMessages(alice, ['Message 1', 'Message 2', 'Message 3']);
  const bodies = ciphertexts.map((ciphertext) => ciphertext.body);
  const allDifferent = new Set(bodies).size === bodies.length;

  return {
    name: 'Test C',
    ciphertexts: ciphertextSummary(ciphertexts),
    allCiphertextsDifferent: allDifferent,
    passed: allDifferent,
  };
}

const results = [await testInOrder(), await testOutOfOrderAndReplay(), await testCiphertextDifference()];
const passed = results.every((result) => result.passed);
console.log(JSON.stringify({ phase: 6, results, passed }, null, 2));
if (!passed) process.exitCode = 1;
