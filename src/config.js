import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3443),
  httpPort: Number(process.env.HTTP_PORT || 3000),
  useHttps: process.env.USE_HTTPS !== 'false',
  sslKeyPath: process.env.SSL_KEY_PATH || path.resolve(__dirname, '../certs/server.key'),
  sslCertPath: process.env.SSL_CERT_PATH || path.resolve(__dirname, '../certs/server.crt'),
  channelName: process.env.KICK_CHANNEL || 'twoj-kanal',
  kickEventWs: process.env.KICK_EVENT_WS || '',
  train: {
    minUniqueGifters: Number(process.env.MIN_UNIQUE_GIFTERS || 2),
    activationWindowSec: Number(process.env.ACTIVATION_WINDOW_SEC || 300),
    baseGoal: Number(process.env.TRAIN_BASE_GOAL || 25),
    goalMultiplier: Number(process.env.TRAIN_GOAL_MULTIPLIER || 1.25),
    levelDurationSec: Number(process.env.LEVEL_DURATION_SEC || 300),
    maxQueue: Number(process.env.MAX_QUEUE || 100)
  },
  adminToken: process.env.ADMIN_TOKEN || 'change-me',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../data/hypertrain.db')
};
