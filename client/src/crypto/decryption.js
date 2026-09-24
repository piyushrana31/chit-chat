export async function decryptMessage({ sessionManager, remoteUserId, ciphertext }) {
  if (!ciphertext || !ciphertext.body || !Number.isInteger(ciphertext.type)) {
    throw new Error('A Signal ciphertext payload is required');
  }
  return sessionManager.decrypt(remoteUserId, ciphertext);
}
