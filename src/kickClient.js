import EventEmitter from 'node:events';
import WebSocket from 'ws';

export class KickGiftClient extends EventEmitter {
  constructor({ wsUrl, reconnectDelayMs = 5000 }) {
    super();
    this.wsUrl = wsUrl;
    this.reconnectDelayMs = reconnectDelayMs;
    this.ws = null;
    this.stopped = false;
  }

  start() {
    if (!this.wsUrl) {
      this.emit('log', 'Brak KICK_EVENT_WS. Użyj /api/kick/webhook lub /api/simulate do testów.');
      return;
    }
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    this.emit('log', `Łączenie z Kick event source: ${this.wsUrl}`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => this.emit('log', 'Połączono z Kick event source'));
    this.ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const event = this.parseGiftEvent(data);
        if (event) this.emit('gift', event);
      } catch (error) {
        this.emit('log', `Błąd parsowania eventu: ${error.message}`);
      }
    });
    this.ws.on('close', () => {
      this.emit('log', 'Rozłączono z Kick event source, auto reconnect...');
      setTimeout(() => this.connect(), this.reconnectDelayMs);
    });
    this.ws.on('error', (err) => {
      this.emit('log', `WebSocket error: ${err.message}`);
      this.ws?.close();
    });
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
  }

  parseGiftEvent(data) {
    if (!data) return null;
    const normalizedType = (data.type || data.event || '').toLowerCase();
    const isGift = normalizedType.includes('gift') || normalizedType.includes('subscription_gifted');
    if (!isGift && !data.isGiftSub) return null;

    return {
      gifter: data.gifter || data.username || data.sender || 'unknown',
      recipient: data.recipient || data.target || null,
      quantity: Number(data.quantity || data.count || 1),
      createdAt: new Date().toISOString(),
      source: 'kick_ws'
    };
  }
}
