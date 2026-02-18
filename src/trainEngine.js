import EventEmitter from 'node:events';

const noopRepository = {
  saveGiftEvent() {},
  createTrainRun() {
    return null;
  },
  finishTrainRun() {}
};

export class TrainEngine extends EventEmitter {
  constructor(cfg, repository = noopRepository) {
    super();
    this.cfg = cfg;
    this.repository = repository;
    this.recentActivationEvents = [];
    this.state = this.defaultState();
  }

  defaultState() {
    return {
      active: false,
      trainId: null,
      level: 1,
      progress: 0,
      goal: this.cfg.baseGoal,
      totalGifts: 0,
      queue: [],
      gifterTotals: {},
      triggerGifters: [],
      startedAt: null,
      endsAt: null
    };
  }

  receiveGift(event) {
    this.repository.saveGiftEvent(event);

    const now = Date.now();
    this.recentActivationEvents.push({ ...event, ts: now });
    const minTs = now - (this.cfg.activationWindowSec * 1000);
    this.recentActivationEvents = this.recentActivationEvents.filter((e) => e.ts >= minTs);

    this.enqueue(event);
    this.emit('gift', event);

    if (!this.state.active) {
      const uniqueGifters = [...new Set(this.recentActivationEvents.map((e) => e.gifter))];
      if (uniqueGifters.length >= this.cfg.minUniqueGifters) {
        this.startTrain(uniqueGifters);
        this.applyEvent(event);
      }
      return;
    }

    this.applyEvent(event);
  }

  enqueue(event) {
    this.state.queue.push(event);
    if (this.state.queue.length > this.cfg.maxQueue) {
      this.state.queue.shift();
    }
  }

  startTrain(triggerGifters) {
    const queueSnapshot = [...this.state.queue];
    this.state = {
      ...this.defaultState(),
      active: true,
      triggerGifters,
      queue: queueSnapshot,
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + this.cfg.levelDurationSec * 1000).toISOString()
    };

    this.state.trainId = this.repository.createTrainRun(triggerGifters);
    this.emitState('started');
  }

  tick() {
    if (!this.state.active || !this.state.endsAt) {
      return;
    }
    const remainingMs = new Date(this.state.endsAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      this.stopTrain('timeout');
    }
  }

  applyEvent(event) {
    this.state.totalGifts += event.quantity;
    this.state.gifterTotals[event.gifter] = (this.state.gifterTotals[event.gifter] || 0) + event.quantity;
    this.state.progress += event.quantity;

    while (this.state.progress >= this.state.goal) {
      this.state.progress -= this.state.goal;
      this.state.level += 1;
      this.state.goal = Math.ceil(this.state.goal * this.cfg.goalMultiplier);
      this.state.endsAt = new Date(Date.now() + this.cfg.levelDurationSec * 1000).toISOString();
      this.emitState('level_up');
    }

    this.emitState('updated');
  }

  stopTrain(status = 'completed') {
    if (!this.state.active) return;

    this.repository.finishTrainRun({
      trainId: this.state.trainId,
      level: this.state.level,
      totalGifts: this.state.totalGifts,
      status
    });

    this.emitState('ended', { status });
    this.state = this.defaultState();
  }

  emitState(type, extra = {}) {
    this.emit('state', {
      type,
      ...extra,
      state: this.getPublicState()
    });
  }

  getPublicState() {
    const endsAtMs = this.state.endsAt ? new Date(this.state.endsAt).getTime() : null;
    return {
      ...this.state,
      remainingSec: endsAtMs ? Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000)) : 0
    };
  }
}
