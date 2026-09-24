import { Direction, KeyHelper } from '@privacyresearch/libsignal-protocol-typescript';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function arrayBufferToBase64(value) {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToArrayBuffer(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export function binaryStringToBase64(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return arrayBufferToBase64(bytes.buffer);
}

export function base64ToBinaryString(value) {
  const bytes = new Uint8Array(base64ToArrayBuffer(value));
  return String.fromCharCode(...bytes);
}

export function textToArrayBuffer(value) {
  return encoder.encode(value).buffer;
}

export function arrayBufferToText(value) {
  return decoder.decode(value);
}

function pairToJson(pair) {
  return { pubKey: arrayBufferToBase64(pair.pubKey), privKey: arrayBufferToBase64(pair.privKey) };
}

function pairFromJson(pair) {
  return { pubKey: base64ToArrayBuffer(pair.pubKey), privKey: base64ToArrayBuffer(pair.privKey) };
}

class PersistentSignalStore {
  constructor(namespace) {
    this.namespace = namespace;
    this.memory = new Map();
  }

  get indexedDb() {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  }

  async read(key) {
    if (!this.indexedDb) {
      const raw = this.memory.get(key);
      return raw === undefined ? undefined : JSON.parse(raw);
    }
    return new Promise((resolve, reject) => {
      const request = this.indexedDb.open('secure-chat-signal', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('state', 'readonly');
        const getRequest = transaction.objectStore('state').get(`${this.namespace}:${key}`);
        getRequest.onsuccess = () => resolve(getRequest.result === undefined ? undefined : JSON.parse(getRequest.result));
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  async write(key, value) {
    const raw = JSON.stringify(value);
    if (!this.indexedDb) {
      this.memory.set(key, raw);
      return;
    }
    return new Promise((resolve, reject) => {
      const request = this.indexedDb.open('secure-chat-signal', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('state', 'readwrite');
        transaction.objectStore('state').put(raw, `${this.namespace}:${key}`);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  async remove(key) {
    if (!this.indexedDb) {
      this.memory.delete(key);
      return;
    }
    return new Promise((resolve, reject) => {
      const request = this.indexedDb.open('secure-chat-signal', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('state', 'readwrite');
        transaction.objectStore('state').delete(`${this.namespace}:${key}`);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  async getIdentityKeyPair() {
    const pair = await this.read('identity');
    return pair ? pairFromJson(pair) : undefined;
  }

  async getLocalRegistrationId() {
    return this.read('registrationId');
  }

  async isTrustedIdentity(identifier, identityKey) {
    const key = `trusted:${identifier}`;
    const existing = await this.read(key);
    if (!existing) return true;
    return existing === arrayBufferToBase64(identityKey);
  }

  async saveIdentity(encodedAddress, publicKey) {
    const key = `trusted:${encodedAddress}`;
    const encoded = arrayBufferToBase64(publicKey);
    const existing = await this.read(key);
    if (existing && existing !== encoded) return false;
    await this.write(key, encoded);
    return true;
  }

  async loadPreKey(keyId) {
    const value = await this.read(`prekey:${keyId}`);
    return value ? pairFromJson(value) : undefined;
  }

  async storePreKey(keyId, keyPair) {
    await this.write(`prekey:${keyId}`, pairToJson(keyPair));
  }

  async removePreKey(keyId) {
    await this.remove(`prekey:${keyId}`);
  }

  async storeSession(encodedAddress, record) {
    await this.write(`session:${encodedAddress}`, record);
  }

  async loadSession(encodedAddress) {
    return this.read(`session:${encodedAddress}`);
  }

  async loadSignedPreKey(keyId) {
    const value = await this.read(`signed-prekey:${keyId}`);
    return value ? { ...pairFromJson(value), signature: base64ToArrayBuffer(value.signature) } : undefined;
  }

  async storeSignedPreKey(keyId, keyPair) {
    await this.write(`signed-prekey:${keyId}`, { ...pairToJson(keyPair), signature: arrayBufferToBase64(keyPair.signature) });
  }

  async removeSignedPreKey(keyId) {
    await this.remove(`signed-prekey:${keyId}`);
  }
}

export function createSignalStore(namespace) {
  return new PersistentSignalStore(namespace);
}

export async function createKeyManager({ namespace = 'secure-chat:signal', oneTimePreKeyCount = 20 } = {}) {
  const store = createSignalStore(namespace);
  let identityKeyPair = await store.getIdentityKeyPair();
  let registrationId = await store.getLocalRegistrationId();
  let signedPreKey = await store.loadSignedPreKey(1);

  if (!identityKeyPair) {
    identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    await store.write('identity', pairToJson(identityKeyPair));
  }
  if (!registrationId) {
    registrationId = KeyHelper.generateRegistrationId();
    await store.write('registrationId', registrationId);
  }
  if (!signedPreKey) {
    const generated = await KeyHelper.generateSignedPreKey(identityKeyPair, 1);
    signedPreKey = { ...generated.keyPair, signature: generated.signature };
    await store.storeSignedPreKey(1, signedPreKey);
  }

  const oneTimePreKeys = [];
  for (let keyId = 1; keyId <= oneTimePreKeyCount; keyId += 1) {
    const existing = await store.loadPreKey(keyId);
    if (existing) {
      oneTimePreKeys.push({ keyId, publicKey: existing.pubKey });
      continue;
    }
    const generated = await KeyHelper.generatePreKey(keyId);
    await store.storePreKey(keyId, generated.keyPair);
    oneTimePreKeys.push({ keyId, publicKey: generated.keyPair.pubKey });
  }

  return {
    store,
    registrationId,
    identityKeyPair,
    signedPreKey,
    oneTimePreKeys,
    publicBundle() {
      return {
        registrationId,
        identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
        signedPreKey: {
          keyId: 1,
          publicKey: arrayBufferToBase64(signedPreKey.pubKey),
          signature: arrayBufferToBase64(signedPreKey.signature),
        },
        oneTimePreKeys: oneTimePreKeys.map((preKey) => ({ keyId: preKey.keyId, publicKey: arrayBufferToBase64(preKey.publicKey) })),
      };
    },
  };
}

export { Direction };
