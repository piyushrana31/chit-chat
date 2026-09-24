import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'dev-secret-change-me', {
      expiresIn: '7d',
    });

    return res.status(201).json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register user', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'dev-secret-change-me', {
      expiresIn: '7d',
    });

    return res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in', error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load current user', error: error.message });
  }
});

router.get('/users/:username', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('_id username online').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: { id: String(user._id), username: user.username, online: user.online } });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to find user', error: error.message });
  }
});

export default router;
