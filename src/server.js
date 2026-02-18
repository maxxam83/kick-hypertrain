import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { execSync } from 'node:child_process';

import { config } from './config.js';
import { getStats } from './db.js';
import { sqliteRepository } from './repository.js';
import { TrainEngine } from './trainEngine.js';
import { KickGiftClient } from './kickClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(publicDir));

const trainEngine = new TrainEngine(config.train, sqliteRepository);
const kickClient = new KickGiftClient({ wsUrl: config.kickEventWs });

const logs = [];
function addLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  logs.push(line);
  if (logs.length > 200) logs.shift();
  console.log(line);
}

kickClient.on('gift', (event) => trainEngine.receiveGift(event));
kickClient.on('log', addLog);

setInterval(() => trainEngine.tick(), 1000);

function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== config.adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/state', (_req, res) => res.json(trainEngine.getPublicState()));
app.get('/api/stats', auth, (_req, res) => res.json(getStats()));
app.get('/api/logs', auth, (_req, res) => res.json({ logs }));

app.post('/api/kick/webhook', (req, res) => {
  const payload = req.body || {};
  const event = {
    gifter: payload.gifter || payload.username,
    recipient: payload.recipient || null,
    quantity: Number(payload.quantity || 1),
    createdAt: new Date().toISOString(),
    source: 'kick_webhook'
  };
  if (!event.gifter) {
    return res.status(400).json({ error: 'Missing gifter' });
  }
  trainEngine.receiveGift(event);
  res.json({ ok: true });
});

app.post('/api/simulate', auth, (req, res) => {
  const { gifter = 'tester', recipient = null, quantity = 1 } = req.body || {};
  trainEngine.receiveGift({
    gifter,
    recipient,
    quantity: Number(quantity),
    createdAt: new Date().toISOString(),
    source: 'simulate'
  });
  res.json({ ok: true });
});

app.post('/api/train/stop', auth, (_req, res) => {
  trainEngine.stopTrain('manual_stop');
  res.json({ ok: true });
});

let server;
if (config.useHttps) {
  if (!fs.existsSync(config.sslKeyPath) || !fs.existsSync(config.sslCertPath)) {
    fs.mkdirSync(path.dirname(config.sslKeyPath), { recursive: true });
    fs.mkdirSync(path.dirname(config.sslCertPath), { recursive: true });
    addLog('Brak certyfikatów SSL. Generuję self-signed cert...');
    execSync(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${config.sslKeyPath} -out ${config.sslCertPath} -subj "/CN=localhost"`);
  }
  server = https.createServer({
    key: fs.readFileSync(config.sslKeyPath),
    cert: fs.readFileSync(config.sslCertPath)
  }, app);
} else {
  server = http.createServer(app);
}

const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
  socket.emit('state', { type: 'sync', state: trainEngine.getPublicState() });
});

trainEngine.on('state', (payload) => io.emit('state', payload));
trainEngine.on('gift', (event) => io.emit('gift', event));

server.listen(config.port, config.host, () => {
  addLog(`Kick Hypertrain running on ${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}`);
  kickClient.start();
});
