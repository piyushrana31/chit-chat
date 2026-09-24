import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import KeyBundle from '../models/KeyBundle.js';

const router = express.Router();

router.get('/:userId', requireAuth, (req, res) => {
  return KeyBundle.findOneAndUpdate(
    { userId: req.params.userId },
    { $pop: { oneTimePreKeys: -1 } },
    { new: false, lean: true }
  )
    .then((bundle) => {
      if (!bundle) {
        return res.status(404).json({ message: 'Key bundle not found' });
      }

      const oneTimePreKey = bundle.oneTimePreKeys?.[0];
      return res.json({
        userId: String(bundle.userId),
        identityKey: bundle.identityPublicKey,
        signedPreKey: {
          keyId: bundle.signedPreKey.keyId,
          publicKey: bundle.signedPreKey.publicKey,
          signature: bundle.signedPreKey.signature,
        },
        preKey: oneTimePreKey || undefined,
        registrationId: bundle.registrationId,
      });
    })
    .catch((error) => res.status(500).json({ message: 'Failed to retrieve key bundle', error: error.message }));
});

router.post('/', requireAuth, async (req, res) => {
  const { registrationId, identityKey, signedPreKey, oneTimePreKeys } = req.body;

  if (!Number.isInteger(registrationId) || !identityKey || !Number.isInteger(signedPreKey?.keyId) || !signedPreKey.publicKey || !signedPreKey.signature || !Array.isArray(oneTimePreKeys) || oneTimePreKeys.some((preKey) => !Number.isInteger(preKey?.keyId) || !preKey.publicKey)) {
    return res.status(400).json({ message: 'A complete public key bundle is required' });
  }

  try {
    const bundle = await KeyBundle.findOneAndUpdate(
      { userId: req.user.userId },
      { userId: req.user.userId, registrationId, identityPublicKey: identityKey, signedPreKey, oneTimePreKeys },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return res.status(201).json({ userId: String(bundle.userId), registrationId: bundle.registrationId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to publish key bundle', error: error.message });
  }
});

router.post('/prekeys', requireAuth, async (req, res) => {
  const { oneTimePreKeys } = req.body;
  if (!Array.isArray(oneTimePreKeys)) {
    return res.status(400).json({ message: 'oneTimePreKeys must be an array' });
  }

  try {
    await KeyBundle.updateOne({ userId: req.user.userId }, { $push: { oneTimePreKeys: { $each: oneTimePreKeys } } });
    return res.status(201).json({ count: oneTimePreKeys.length });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to publish prekeys', error: error.message });
  }
});

export default router;
