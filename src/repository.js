import { createTrainRun, finishTrainRun, saveGiftEvent } from './db.js';

export const sqliteRepository = {
  saveGiftEvent,
  createTrainRun,
  finishTrainRun
};
