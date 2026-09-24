export async function encryptMessage({ sessionManager, remoteUserId, plaintext }) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Plaintext message must be a non-empty string');
  }
  return sessionManager.encrypt(remoteUserId, plaintext);
}
