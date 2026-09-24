import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript';
import {
  arrayBufferToBase64,
  arrayBufferToText,
  base64ToBinaryString,
  base64ToArrayBuffer,
  binaryStringToBase64,
  textToArrayBuffer,
} from './keyManager.js';

function deviceFromBundle(bundle) {
  return {
    identityKey: base64ToArrayBuffer(bundle.identityKey),
    signedPreKey: {
      keyId: bundle.signedPreKey.keyId,
      publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
      signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
    },
    preKey: bundle.preKey
      ? { keyId: bundle.preKey.keyId, publicKey: base64ToArrayBuffer(bundle.preKey.publicKey) }
      : undefined,
    registrationId: bundle.registrationId,
  };
}

export function createSessionManager({ store, localUserId }) {
  const addressFor = (remoteUserId) => new SignalProtocolAddress(String(remoteUserId), 1);

  return {
    async establishSession(remoteUserId, bundle) {
      const address = addressFor(remoteUserId);
      const builder = new SessionBuilder(store, address);
      await builder.processPreKey(deviceFromBundle(bundle));
      return address.toString();
    },

    async encrypt(remoteUserId, plaintext) {
      const address = addressFor(remoteUserId);
      const cipher = new SessionCipher(store, address);
      const result = await cipher.encrypt(textToArrayBuffer(plaintext));
      return {
        type: result.type,
        body: binaryStringToBase64(result.body),
        registrationId: result.registrationId,
        senderId: String(localUserId),
        receiverId: String(remoteUserId),
      };
    },

    async decrypt(remoteUserId, ciphertext) {
      const address = addressFor(remoteUserId);
      const cipher = new SessionCipher(store, address);
      const body = base64ToBinaryString(ciphertext.body);
      const plaintext = ciphertext.type === 3
        ? await cipher.decryptPreKeyWhisperMessage(body)
        : await cipher.decryptWhisperMessage(body);
      return arrayBufferToText(plaintext);
    },
  };
}
