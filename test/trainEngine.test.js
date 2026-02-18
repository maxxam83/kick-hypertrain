import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainEngine } from '../src/trainEngine.js';

const cfg = {
  minUniqueGifters: 2,
  activationWindowSec: 300,
  baseGoal: 10,
  goalMultiplier: 1.2,
  levelDurationSec: 300,
  maxQueue: 100
};

test('starts train when at least 2 unique gifters gift in window', () => {
  const engine = new TrainEngine(cfg);
  engine.receiveGift({ gifter: 'a', quantity: 1, createdAt: new Date().toISOString(), source: 'test' });
  assert.equal(engine.getPublicState().active, false);

  engine.receiveGift({ gifter: 'b', quantity: 1, createdAt: new Date().toISOString(), source: 'test' });
  assert.equal(engine.getPublicState().active, true);
});

test('counts the triggering gift in active train progress', () => {
  const engine = new TrainEngine(cfg);
  engine.receiveGift({ gifter: 'a', quantity: 2, createdAt: new Date().toISOString(), source: 'test' });
  engine.receiveGift({ gifter: 'b', quantity: 3, createdAt: new Date().toISOString(), source: 'test' });

  const state = engine.getPublicState();
  assert.equal(state.active, true);
  assert.equal(state.totalGifts, 3);
  assert.equal(state.progress, 3);
});

test('keeps pre-train queue history after activation', () => {
  const engine = new TrainEngine(cfg);
  engine.receiveGift({ gifter: 'a', quantity: 1, createdAt: new Date().toISOString(), source: 'test' });
  engine.receiveGift({ gifter: 'b', quantity: 1, createdAt: new Date().toISOString(), source: 'test' });

  const state = engine.getPublicState();
  assert.equal(state.queue.length, 2);
  assert.equal(state.queue[0].gifter, 'a');
  assert.equal(state.queue[1].gifter, 'b');
});
