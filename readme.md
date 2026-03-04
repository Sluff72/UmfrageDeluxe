# UmfrageDeluxe

Konsensorientiertes Online-Umfragetool mit widerstandsbasierter Abstimmung, Einwand-Integration und Phasen-Workflow.

## Tech Stack

- **Frontend**: Next.js (App Router) + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Datenbank**: SQLite (better-sqlite3)
- **Echtzeit**: Socket.IO
- **Containerisierung**: Docker + Caddy Reverse Proxy

## Lokale Entwicklung

```bash
# Backend starten
cd backend/ && npm install && npm run dev

# Frontend starten (in neuem Terminal)
cd frontend/ && npm install && npm run dev
```

Backend läuft auf `http://localhost:3001`, Frontend auf `http://localhost:3000`.

## Lokale Entwicklung mit Docker

```bash
docker compose build
docker compose up
```

Öffne `http://localhost:3000` im Browser.

## Production Deployment

### Voraussetzungen

- Server mit Docker und Docker Compose (z.B. Hetzner CX22, ab ~3,50 EUR/Monat)
- Domain mit DNS-A-Record auf die Server-IP

### Schritte

1. Repository auf den Server klonen:

```bash
git clone <repo-url> umfrage-deluxe
cd umfrage-deluxe
```

2. `.env`-Datei aus dem Beispiel erstellen:

```bash
cp .env.production.example .env
```

3. Werte in `.env` eintragen:

```env
JWT_SECRET=<openssl rand -base64 32>
SITE_ADDRESS=umfrage.deinedomain.de
```

4. Production-Stack starten:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Caddy kümmert sich automatisch um SSL-Zertifikate via Let's Encrypt.

### Architektur (Production)

```
Internet → Caddy (:80/:443)
              ├── /api/*        → Backend (:3001)
              ├── /socket.io/*  → Backend (:3001)
              └── /*            → Frontend (:3000)
```

- **Caddy**: Reverse Proxy + automatisches SSL
- **Frontend**: Next.js Standalone (keine exponierten Ports)
- **Backend**: Express + Socket.IO (keine exponierten Ports)
- **SQLite**: Persistiert in Docker Named Volume

### Nützliche Befehle

```bash
# Logs anzeigen
docker compose -f docker-compose.prod.yml logs -f

# Neustart
docker compose -f docker-compose.prod.yml restart

# Update deployen
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Stoppen
docker compose -f docker-compose.prod.yml down
```

## Tests

```bash
cd backend/ && npm test
```
