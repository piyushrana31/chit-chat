import mongoose from 'mongoose';

const keyBundleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    identityPublicKey: {
      type: String,
      required: true,
    },
    registrationId: {
      type: Number,
      required: true,
    },
    signedPreKey: {
      type: new mongoose.Schema(
        {
        keyId: { type: Number, required: true },
        publicKey: { type: String, required: true },
        signature: { type: String, required: true },
        },
        { _id: false }
      ),
      required: true,
    },
    oneTimePreKeys: {
      type: [
        {
          keyId: { type: Number, required: true },
          publicKey: { type: String, required: true },
        },
      ],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('KeyBundle', keyBundleSchema);
