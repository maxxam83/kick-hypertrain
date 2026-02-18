# Kick Hypertrain Bot (HTTPS + OBS Overlay + Admin UI + DB Stats)

Kompletne rozwiązanie inspirowane `Hypertrain` z Twitcha, ale pod Kick:
- ✅ śledzenie gift subów i aktywacja po **min. 2 unikalnych gifterach**,
- ✅ auto reconnect klienta eventów Kick (WebSocket),
- ✅ kolejka eventów + poziomy + progress bar,
- ✅ overlay OBS (WebGL + animacje + alert dźwiękowy),
- ✅ admin panel web UI,
- ✅ HTTPS,
- ✅ baza danych SQLite + statystyki.

## 1) Architektura

- **Backend**: Node.js + Express + Socket.IO
- **DB**: SQLite (`better-sqlite3`)
- **Realtime**: Socket.IO (admin i overlay dostają stan live)
- **Kick ingest**:
  - WebSocket source (`KICK_EVENT_WS`) + auto reconnect
  - lub webhook `POST /api/kick/webhook`
- **Frontend**:
  - `/admin.html` – panel administracyjny
  - `/overlay.html` – gotowy overlay do OBS

## 2) Szybki start lokalny

```bash
cp .env.example .env
npm install
npm start
```

Domyślnie aplikacja wystartuje na: `https://localhost:3443`

> Przy pierwszym starcie wygeneruje self-signed cert (`certs/server.crt`, `certs/server.key`) jeśli brak.

## 3) Konfiguracja

Najważniejsze zmienne (`.env`):

- `ADMIN_TOKEN` – token do endpointów admin
- `MIN_UNIQUE_GIFTERS=2` – liczba unikalnych gifterów do odpalenia traina
- `ACTIVATION_WINDOW_SEC=300` – okno aktywacji (sekundy)
- `TRAIN_BASE_GOAL=25` – próg level 1
- `TRAIN_GOAL_MULTIPLIER=1.25` – wzrost celu na kolejny level
- `LEVEL_DURATION_SEC=300` – timer levela
- `KICK_EVENT_WS` – URL źródła eventów WS (opcjonalnie)

## 4) Endpointy API

Public:
- `GET /health`
- `GET /api/state`
- `POST /api/kick/webhook` (body: `{ gifter, recipient?, quantity? }`)

Admin (`x-admin-token`):
- `GET /api/stats`
- `GET /api/logs`
- `POST /api/simulate`
- `POST /api/train/stop`

## 5) OBS Overlay (gotowy)

W OBS dodaj Browser Source:
- URL: `https://<twoj-host>:3443/overlay.html`
- Width/Height: np. `1920x1080`
- Shutdown source when not visible: OFF
- Refresh browser when scene becomes active: ON

## 6) Docker (z Admin UI)

```bash
cp .env.example .env
# ustaw ADMIN_TOKEN
docker compose up -d --build
```

Aplikacja: `https://<host>:3443`

## 7) Deploy na VPS krok po kroku

### 7.1 Ubuntu 22.04+

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 7.2 Wdrożenie aplikacji

```bash
git clone <twoje-repo> kick-hypertrain
cd kick-hypertrain
cp .env.example .env
nano .env
docker compose up -d --build
```

### 7.3 Reverse proxy + cert Let's Encrypt (opcjonalnie, rekomendowane)

Najprościej postawić Caddy/Nginx przed kontenerem, żeby mieć cert trusted dla OBS.

Przykład Caddyfile:

```caddy
hypertrain.twojadomena.pl {
  reverse_proxy 127.0.0.1:3443
}
```

### 7.4 Monitoring

```bash
docker compose logs -f
```

## 8) Przepływ eventów Kick

Masz 2 warianty:

1. **WS ingest**: ustaw `KICK_EVENT_WS=wss://...` i mapuj eventy gift subów.
2. **Webhook ingest**: zewnętrzny listener Kick wysyła do:
   `POST https://<host>:3443/api/kick/webhook`

Payload:

```json
{
  "gifter": "nick123",
  "recipient": "viewerX",
  "quantity": 5
}
```

## 9) Statystyki i baza danych

- DB file: `data/hypertrain.db`
- Tabele:
  - `gift_events` – każdy event gift sub
  - `train_runs` – historia pociągów

Admin UI pobiera:
- top gifterów,
- ostatnie hypertrainy,
- podsumowanie globalne.

## 10) AAA style / WebGL / audio

`/overlay.html` zawiera:
- animowany tunel WebGL (`three.js`),
- pasek progresu,
- level/timer,
- alert audio przy `started` i `level_up`.

## 11) Testy

```bash
npm test
```

## 12) Uwaga o Kick API

Kick może zmieniać format eventów; parser w `src/kickClient.js` jest celowo defensywny i normalizuje pola. W produkcji dopasuj `parseGiftEvent` do finalnego schematu z Twojego źródła eventów.
