import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/index.js';
import { createWebSocketServer } from './websocket/websocketServer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const configuredClientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  if (configuredClientOrigins.includes(normalizedOrigin)) return true;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname)
      && url.protocol === 'http:'
      && url.port.startsWith('517');
  } catch {
    return false;
  }
}

app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin : false), credentials: true }));
app.use(express.json());
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'secure-chat-server', dbConnected: false });
});

const httpServer = createServer(app);
createWebSocketServer({ server: httpServer, jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me' });

async function startServer() {
  const dbConnected = await connectDB();

  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'secure-chat-server', dbConnected });
  });

  httpServer.listen(PORT, () => {
    console.log(`Secure chat server listening on http://localhost:${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
    if (!dbConnected) {
      console.log('MongoDB is not connected; this is acceptable for local Phase 1 startup testing.');
    }
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
