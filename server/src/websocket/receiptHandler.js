import mongoose from 'mongoose';
import MessageMetadata from '../models/MessageMetadata.js';

export async function handleReceipt({ receipt, authenticatedUserId, connectionManager }) {
  if (!['MESSAGE_DELIVERED', 'MESSAGE_READ'].includes(receipt.type) || typeof receipt.messageId !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(receipt.messageId)) {
    return { ok: false, reason: 'invalid_receipt' };
  }

  if (!mongoose.Types.ObjectId.isValid(authenticatedUserId)) {
    return { ok: false, reason: 'invalid_user' };
  }

  const metadata = await MessageMetadata.findOne({ messageId: receipt.messageId }).lean();
  if (!metadata) return { ok: false, reason: 'message_not_found' };

  if (String(metadata.receiverId) !== String(authenticatedUserId)) {
    return { ok: false, reason: 'receipt_not_authorized' };
  }

  const field = receipt.type === 'MESSAGE_DELIVERED' ? 'deliveredAt' : 'readAt';
  const status = receipt.type === 'MESSAGE_DELIVERED' ? 'DELIVERED' : 'READ';
  await MessageMetadata.updateOne(
    { messageId: receipt.messageId },
    { $set: { [field]: metadata[field] || new Date(), status: metadata.status === 'READ' ? 'READ' : status } }
  );

  const outgoing = receipt.type === 'MESSAGE_DELIVERED'
    ? {
      type: receipt.type,
      messageId: receipt.messageId,
      senderId: String(metadata.senderId),
      receiverId: String(metadata.receiverId),
      timestamp: new Date().toISOString(),
    }
    : {
      type: receipt.type,
      messageId: receipt.messageId,
      senderId: String(metadata.senderId),
      readerId: String(metadata.receiverId),
      timestamp: new Date().toISOString(),
    };

  const targetSocket = connectionManager.getConnection(String(metadata.senderId));
  if (!targetSocket) {
    return { ok: false, delivered: false, reason: 'offline', receipt: outgoing };
  }

  targetSocket.send(JSON.stringify(outgoing));
  return { ok: true, delivered: true, receipt: outgoing };
}
