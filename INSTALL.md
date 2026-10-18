# UmfrageDeluxe – Installation & Hosting

Diese Anleitung beschreibt drei Wege, UmfrageDeluxe zu betreiben:

1. [Lokale Entwicklung ohne Docker](#1-lokale-entwicklung-ohne-docker)
2. [Lokale Entwicklung mit Docker](#2-lokale-entwicklung-mit-docker)
3. [Production-Deployment auf einem Server](#3-production-deployment)

## Voraussetzungen

- **Ohne Docker**: Node.js ≥ 20 und npm
- **Mit Docker**: Docker Engine + Docker Compose Plugin
- **Production**: Ein Server (z.B. Hetzner CX22, ab ~3,50 EUR/Monat), eine Domain mit DNS-A-Record auf die Server-IP und ein Reverse Proxy (siehe unten)

## 1. Lokale Entwicklung ohne Docker

### Backend (Port 3001)

```bash
cd backend/
npm install
```

Lege eine `backend/.env` an (Orientierung: `.env.example` im Projekt-Root):

```env
JWT_SECRET=ein-zufaelliger-geheimer-wert
PORT=3001
DATABASE_PATH=./data/umfrage.db
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
# Optional: Benutzernamen mit Zugriff auf die Nutzerverwaltung (kommagetrennt)
ADMIN_USERNAMES=heinz
```

Dann starten:

```bash
npm run dev
```

### Frontend (Port 3000)

```bash
cd frontend/
npm install
```

Lege eine `frontend/.env.local` an:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

Dann starten:

```bash
npm run dev
```

Die App ist unter `http://localhost:3000` erreichbar.

## 2. Lokale Entwicklung mit Docker

Im Projekt-Root:

```bash
JWT_SECRET=$(openssl rand -base64 32) docker compose up --build
```

Die Container nutzen andere Ports als das npm-Setup:

- Frontend: `http://localhost:3030`
- Backend-API: `http://localhost:3029`

Die SQLite-Datenbank wird im Named Volume `sqlite-data` persistiert.

## 3. Production-Deployment

### Architektur

`docker-compose.prod.yml` startet Backend und Frontend und veröffentlicht sie auf den Host-Ports **3029** (Backend) und **3030** (Frontend). Davor gehört ein **Reverse Proxy**, der TLS terminiert und nach Pfad routet – beide Services laufen unter **einer** Domain:

```
Internet → Reverse Proxy (:443, TLS)
              ├── /api/*        → localhost:3029 (Backend)
              ├── /socket.io/*  → localhost:3029 (Backend, WebSocket)
              └── /*            → localhost:3030 (Frontend)
```

Das Frontend ruft die API im Production-Build relativ auf (`/api/...`), daher ist das pfadbasierte Routing zwingend – Frontend und Backend dürfen nicht auf getrennten Domains liegen.

### Schritt 1: Repository klonen

```bash
git clone https://github.com/Sluff72/UmfrageDeluxe.git umfrage-deluxe
cd umfrage-deluxe
```

### Schritt 2: Umgebungsvariablen setzen

```bash
cp .env.production.example .env
```

Werte in `.env` eintragen:

```env
# Mit `openssl rand -base64 32` generieren
JWT_SECRET=...

# Deine Domain (wird für CORS verwendet)
SITE_ADDRESS=umfrage.deinedomain.de

# Benutzernamen mit Zugriff auf die Nutzerverwaltung (/admin/users), kommagetrennt
ADMIN_USERNAMES=heinz
```

### Schritt 3: Stack starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Schritt 4: Reverse Proxy einrichten

#### Variante A: nginx-proxy-manager

1. Neuen **Proxy Host** für deine Domain anlegen → Ziel `http://<server-ip>:3030`, SSL-Zertifikat (Let's Encrypt) aktivieren, **Websockets Support** einschalten.
2. Unter **Custom Locations** zwei Locations ergänzen, beide mit Ziel `http://<server-ip>:3029` und Websockets Support:
   - `/api`
   - `/socket.io`

#### Variante B: Caddy

Im Repository liegt eine [Caddyfile](Caddyfile) als Vorlage. Sie verwendet die Docker-internen Hostnamen `backend`/`frontend` – wenn Caddy außerhalb des Compose-Netzwerks läuft, ersetze sie durch `localhost:3029` bzw. `localhost:3030`. Caddy besorgt TLS-Zertifikate automatisch via Let's Encrypt.

### Betrieb

```bash
# Logs anzeigen
docker compose -f docker-compose.prod.yml logs -f

# Neustart
docker compose -f docker-compose.prod.yml restart

# Update deployen
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Stoppen
docker compose -f docker-compose.prod.yml down
```

### Backup

Die SQLite-Datenbank liegt im Docker Volume `sqlite-data`. Backup per:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  sh -c 'cat /data/umfrage.db' > backup-$(date +%F).db
```

Wiederherstellen: Datei zurück ins Volume kopieren (bei gestopptem Stack) und neu starten.

## Hinweis für Betreiber:innen: AGPL-3.0-Pflichten

UmfrageDeluxe steht unter der [AGPL-3.0-or-later](LICENSE). Wer die Software **unverändert** hostet, muss nichts weiter tun – der Quellcode-Link im Footer der App erfüllt die Anforderung von AGPL §13. Wer die Software **verändert** und öffentlich betreibt, muss den Quellcode der veränderten Version den Nutzer:innen zugänglich machen – am einfachsten per Fork auf GitHub und Anpassung des Footer-Links in `frontend/src/app/layout.tsx`.

## Transparenzhinweis: KI-generierte Inhalte

Dieses Dokument wurde KI-generiert (Claude / Claude Code von Anthropic) und menschlich geprüft. Das Projekt selbst wurde agentisch codiert – Details im [README](readme.md#transparenzhinweis-ki-generierte-inhalte). Kenntlichmachung gemäß EU-KI-Verordnung (EU AI Act, Verordnung (EU) 2024/1689).
