import express from 'express';
import authRoutes from './authRoutes.js';
import keyRoutes from './keyRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/keys', keyRoutes);

export default router;
