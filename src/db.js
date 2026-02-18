import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

const dbDir = path.dirname(config.databasePath);
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS gift_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gifter TEXT NOT NULL,
  recipient TEXT,
  quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS train_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  trigger_gifters TEXT NOT NULL,
  final_level INTEGER DEFAULT 1,
  total_gifts INTEGER DEFAULT 0,
  status TEXT NOT NULL
);
`);

const insertGiftStmt = db.prepare('INSERT INTO gift_events (gifter, recipient, quantity, created_at, source) VALUES (?, ?, ?, ?, ?)');
const insertTrainStmt = db.prepare('INSERT INTO train_runs (started_at, trigger_gifters, status) VALUES (?, ?, ?)');
const finishTrainStmt = db.prepare('UPDATE train_runs SET ended_at = ?, final_level = ?, total_gifts = ?, status = ? WHERE id = ?');

export function saveGiftEvent(event) {
  insertGiftStmt.run(event.gifter, event.recipient || null, event.quantity, event.createdAt, event.source || 'kick');
}

export function createTrainRun(triggerGifters) {
  const info = insertTrainStmt.run(new Date().toISOString(), JSON.stringify(triggerGifters), 'active');
  return Number(info.lastInsertRowid);
}

export function finishTrainRun({ trainId, level, totalGifts, status }) {
  finishTrainStmt.run(new Date().toISOString(), level, totalGifts, status, trainId);
}

export function getStats() {
  const summary = db.prepare(`
  SELECT
    COUNT(*) AS totalGiftEvents,
    COALESCE(SUM(quantity), 0) AS totalGiftedSubs,
    COUNT(DISTINCT gifter) AS uniqueGifters
  FROM gift_events
  `).get();

  const topGifters = db.prepare(`
    SELECT gifter, SUM(quantity) AS total
    FROM gift_events
    GROUP BY gifter
    ORDER BY total DESC
    LIMIT 10
  `).all();

  const recentTrains = db.prepare(`
    SELECT *
    FROM train_runs
    ORDER BY id DESC
    LIMIT 20
  `).all().map((row) => ({ ...row, trigger_gifters: JSON.parse(row.trigger_gifters) }));

  return { summary, topGifters, recentTrains };
}
