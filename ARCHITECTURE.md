# UmfrageDeluxe – Architekturdokument

## 1. Projektüberblick

UmfrageDeluxe ist ein konsensorientiertes Online-Umfragetool, inspiriert von soziokratischen Entscheidungsprozessen. Die Anwendung ermöglicht es, Umfragen durch mehrere Phasen zu führen – von der Erstellung über das Sammeln von Optionen und die Abstimmung bis hin zur Integration von Einwänden.

### Kernkonzepte

- **Widerstandsbasierte Abstimmung**: Teilnehmer bewerten ihren Widerstand auf einer Skala von 0-10
- **Phasengesteuerter Workflow**: Umfragen durchlaufen definierte Zustände (State Machine)
- **Einwand-Integration**: Teilnehmer können Einwände formulieren, die vom Host integriert werden
- **Re-Vote-Zyklus**: Nach Integration von Einwänden kann erneut abgestimmt werden
- **Anonyme Teilnahme**: Beitritt über Einladungslink ohne Registrierung möglich

---

## 2. Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Next.js (App Router) + Tailwind CSS + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Datenbank | SQLite (better-sqlite3) |
| Echtzeit | Socket.IO |
| Validierung | Zod |
| Auth | JWT (jsonwebtoken) + argon2id |
| Charts | Recharts |
| Container | Docker + Docker Compose |
| Testing | Vitest + React Testing Library |

---

## 3. Projektstruktur

```
UmfrageDeluxe/
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
├── CLAUDE.md
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── public/
│   │   └── locales/
│   │       └── de/
│   │           └── common.json          # Alle UI-Strings (i18n-ready)
│   └── src/
│       ├── app/                          # Next.js App Router
│       │   ├── layout.tsx
│       │   ├── page.tsx                  # Landing / Redirect
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   ├── dashboard/page.tsx        # Umfragen-Übersicht
│       │   ├── survey/
│       │   │   ├── new/page.tsx          # Neue Umfrage (Entwurf)
│       │   │   └── [surveyId]/
│       │   │       ├── page.tsx          # Hauptansicht (phasenabhängig)
│       │   │       ├── edit/page.tsx     # Einstellungen bearbeiten
│       │   │       └── results/page.tsx  # Auswertung
│       │   └── join/
│       │       └── [inviteCode]/page.tsx # Anonymer Beitritt
│       │
│       ├── components/
│       │   ├── layout/                   # Navbar, Footer, Sidebar
│       │   ├── auth/                     # LoginForm, RegisterForm
│       │   ├── survey/                   # SurveyCard, PhaseController, ShareDialog
│       │   ├── options/                  # OptionList, OptionCard, OptionForm
│       │   ├── voting/                   # ResistanceSlider, VotePanels, PointBudget
│       │   ├── results/                  # ResultsChart, ResistanceHeatmap
│       │   ├── objections/               # ObjectionForm, ObjectionList, ReviewCard
│       │   └── ui/                       # Button, Input, Dialog, Card, Slider, Toast
│       │
│       ├── hooks/
│       │   ├── useSocket.ts              # Socket.IO Connection Manager
│       │   ├── useSurvey.ts              # Survey-Daten + Echtzeit-State
│       │   ├── useAuth.ts                # Auth Context Consumer
│       │   └── useVoteBudget.ts          # W-Max Punkte-Tracking
│       │
│       ├── contexts/
│       │   ├── AuthContext.tsx
│       │   └── SocketContext.tsx
│       │
│       ├── lib/
│       │   ├── api.ts                    # Fetch/Axios Wrapper
│       │   ├── socket.ts                 # Socket.IO Client Singleton
│       │   └── constants.ts
│       │
│       └── types/
│           ├── survey.ts
│           ├── user.ts
│           ├── vote.ts
│           └── objection.ts
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # Express + Socket.IO Bootstrap
│       │
│       ├── config/
│       │   ├── database.ts               # SQLite Connection
│       │   ├── env.ts                    # Env-Variablen Validierung
│       │   └── cors.ts
│       │
│       ├── middleware/
│       │   ├── auth.ts                   # JWT Verification (strict)
│       │   ├── optionalAuth.ts           # JWT oder Anonymous Token
│       │   ├── surveyRole.ts             # Rollen-Check pro Umfrage
│       │   ├── rateLimiter.ts
│       │   └── validate.ts               # Zod Schema Validation
│       │
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── survey.routes.ts
│       │   ├── option.routes.ts
│       │   ├── vote.routes.ts
│       │   └── objection.routes.ts
│       │
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── survey.controller.ts
│       │   ├── option.controller.ts
│       │   ├── vote.controller.ts
│       │   └── objection.controller.ts
│       │
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── survey.service.ts
│       │   ├── option.service.ts
│       │   ├── vote.service.ts
│       │   ├── objection.service.ts
│       │   └── stateMachine.service.ts   # Phasenübergänge + Guard Conditions
│       │
│       ├── socket/
│       │   ├── index.ts                  # Socket.IO Server Setup
│       │   ├── auth.handler.ts           # Socket Auth (JWT oder Guest Token)
│       │   ├── survey.handler.ts         # Room Join/Leave, Phase Events
│       │   └── events.ts                 # Event-Name Konstanten
│       │
│       ├── db/
│       │   ├── migrations/
│       │   │   └── 001_initial.ts
│       │   └── seed.ts                   # Dev Seed Data (optional)
│       │
│       ├── validators/
│       │   ├── auth.schema.ts
│       │   ├── survey.schema.ts
│       │   ├── option.schema.ts
│       │   ├── vote.schema.ts
│       │   └── objection.schema.ts
│       │
│       ├── types/
│       │   ├── survey.types.ts
│       │   ├── user.types.ts
│       │   └── socket.types.ts
│       │
│       └── utils/
│           ├── inviteCode.ts             # Unique Invite-Code Generator
│           ├── voteCalculation.ts        # Ergebnis-Aggregation
│           └── errors.ts                 # Custom Error Classes
│
└── data/
    └── umfrage.db                        # SQLite Datei (Docker Volume)
```

---

## 4. Datenbank-Schema (SQLite)

### 4.1 Users

```sql
CREATE TABLE users (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,               -- argon2id
    display_name    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 4.2 Surveys

```sql
CREATE TABLE surveys (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'entwurf'
                    CHECK(status IN (
                        'entwurf',
                        'optionen_sammeln',
                        'abstimmen',
                        'einwand_integration',
                        'beendet'
                    )),
    voting_method   TEXT NOT NULL DEFAULT 'widerstand'
                    CHECK(voting_method IN (
                        'widerstand_punkte',      -- Mit Punkteregel
                        'widerstand',             -- Ohne Limit
                        'mehrheit'                -- Mehrheitsentscheid
                    )),
    w_max           INTEGER,                      -- Gesamt-Punktebudget (nur widerstand_punkte)
    max_points_per_option INTEGER DEFAULT 5,      -- Max pro Option (nur widerstand_punkte)
    invite_code     TEXT NOT NULL UNIQUE,          -- Kurzcode zum Teilen
    allow_anonymous BOOLEAN NOT NULL DEFAULT 1,
    is_archived     BOOLEAN NOT NULL DEFAULT 0,
    auto_transition_rules TEXT,                    -- JSON: optionale Auto-Advance Config
    created_by      TEXT NOT NULL REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_surveys_invite_code ON surveys(invite_code);
CREATE INDEX idx_surveys_created_by ON surveys(created_by);
```

### 4.3 Survey Participants

Zentrale Zuordnungstabelle – verbindet registrierte User und anonyme Teilnehmer mit Umfragen und Rollen.

```sql
CREATE TABLE survey_participants (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id         TEXT REFERENCES users(id),        -- NULL für anonyme Teilnehmer
    anonymous_name  TEXT,                              -- Anzeigename (anonym)
    anonymous_token TEXT,                              -- Session-Token (anonym)
    role            TEXT NOT NULL DEFAULT 'teilnehmer'
                    CHECK(role IN ('host', 'co_host', 'teilnehmer')),
    joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(survey_id, user_id),
    UNIQUE(survey_id, anonymous_token)
);

CREATE INDEX idx_participants_survey ON survey_participants(survey_id);
CREATE INDEX idx_participants_user ON survey_participants(user_id);
```

### 4.4 Options

```sql
CREATE TABLE options (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    created_by      TEXT NOT NULL REFERENCES survey_participants(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_options_survey ON options(survey_id);
```

### 4.5 Votes

```sql
CREATE TABLE votes (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    option_id       TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    participant_id  TEXT NOT NULL REFERENCES survey_participants(id),
    value           INTEGER NOT NULL,
                    -- widerstand/widerstand_punkte: 0-10 Widerstandswert
                    -- mehrheit: 1 = zustimmen, 0 = ablehnen
    voting_round    INTEGER NOT NULL DEFAULT 1,       -- Unterstützt Re-Votes
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(option_id, participant_id, voting_round)
);

CREATE INDEX idx_votes_survey ON votes(survey_id);
CREATE INDEX idx_votes_option ON votes(option_id);
CREATE INDEX idx_votes_participant ON votes(participant_id);
```

### 4.6 Objections

```sql
CREATE TABLE objections (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    participant_id  TEXT NOT NULL REFERENCES survey_participants(id),
    option_id       TEXT REFERENCES options(id),       -- Optional: bezieht sich auf eine Option
    text            TEXT NOT NULL,                      -- Freitext-Einwand
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'integrated', 'dismissed')),
    host_response   TEXT,                              -- Host-Anmerkung zur Integration
    voting_round    INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_objections_survey ON objections(survey_id);
```

### Design-Entscheidungen

- **TEXT Primary Keys (Hex-UUIDs)**: `lower(hex(randomblob(16)))` erzeugt 32-Zeichen Hex-Strings. Sicher in URLs, keine sequenzielle Enumeration.
- **`survey_participants` als zentrale Tabelle**: Votes und Options referenzieren `participant_id`, nicht `user_id`. So werden anonyme Teilnehmer transparent behandelt.
- **`voting_round`**: Ermöglicht den Re-Vote-Zyklus nach Einwand-Integration (Einwand → Abstimmen → Einwand → ...).
- **`anonymous_token`**: Kryptografisch zufällig generiert, im Browser (localStorage) gespeichert. Identifiziert anonyme Teilnehmer pro Umfrage.

---

## 5. REST API Endpoints

### 5.1 Authentifizierung

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/auth/register` | - | Registrierung (Username + Passwort) |
| `POST` | `/api/auth/login` | - | Login, gibt JWT zurück |
| `GET` | `/api/auth/me` | JWT | Aktuelles Benutzerprofil |
| `POST` | `/api/auth/link-participant` | JWT | Anonymen Token mit Account verknüpfen |

### 5.2 Umfragen

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/surveys` | JWT | Neue Umfrage erstellen (Status: entwurf) |
| `GET` | `/api/surveys` | JWT | Eigene Umfragen auflisten |
| `GET` | `/api/surveys/:id` | JWT/Guest | Umfrage-Details + aktuelle Phase |
| `PUT` | `/api/surveys/:id` | Host | Umfrage-Einstellungen ändern |
| `DELETE` | `/api/surveys/:id` | Host | Umfrage löschen |
| `POST` | `/api/surveys/:id/archive` | Host | Umfrage archivieren |
| `POST` | `/api/surveys/:id/transition` | Host/Co-Host | Zur nächsten Phase wechseln |
| `GET` | `/api/surveys/:id/results` | JWT/Guest | Aggregierte Ergebnisse |
| `POST` | `/api/surveys/join/:inviteCode` | Optional | Per Einladungslink beitreten |

### 5.3 Optionen

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/surveys/:id/options` | Teilnehmer+ | Neue Option hinzufügen |
| `GET` | `/api/surveys/:id/options` | Teilnehmer+ | Alle Optionen auflisten |
| `PUT` | `/api/surveys/:id/options/:optionId` | Ersteller/Host | Option bearbeiten |
| `DELETE` | `/api/surveys/:id/options/:optionId` | Ersteller/Host | Option löschen |

### 5.4 Abstimmung

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/surveys/:id/votes` | Teilnehmer+ | Stimmen abgeben (Batch) |
| `GET` | `/api/surveys/:id/votes` | Host | Alle Stimmen abrufen |
| `GET` | `/api/surveys/:id/votes/mine` | Teilnehmer | Eigene Stimmen abrufen |

**Batch-Vote Payload:**
```json
{
  "votes": [
    { "optionId": "abc123", "value": 7 },
    { "optionId": "def456", "value": 3 }
  ]
}
```

### 5.5 Einwände

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/surveys/:id/objections` | Teilnehmer+ | Einwand einreichen |
| `GET` | `/api/surveys/:id/objections` | Teilnehmer+ | Einwände auflisten |
| `PUT` | `/api/surveys/:id/objections/:objId` | Host | Status/Integration aktualisieren |

---

## 6. Socket.IO Echtzeit-Architektur

### 6.1 Verbindung und Authentifizierung

```typescript
const socket = io(BACKEND_URL, {
  auth: {
    token: jwtToken,                // Registrierter User
    // ODER
    participantToken: anonToken,    // Anonymer Teilnehmer
    surveyId: surveyId
  }
});
```

Jede Umfrage hat einen Socket.IO Room: `survey:{surveyId}`.

### 6.2 Events

**Client → Server**

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `survey:join` | `{ surveyId }` | Room beitreten |
| `survey:leave` | `{ surveyId }` | Room verlassen |

**Server → Client (Broadcast an Room)**

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `survey:phase-changed` | `{ surveyId, newStatus, previousStatus }` | Phasenübergang |
| `survey:updated` | `{ surveyId, changes }` | Einstellungen geändert |
| `survey:participant-joined` | `{ surveyId, participant }` | Neuer Teilnehmer |
| `survey:participant-left` | `{ surveyId, participantId }` | Teilnehmer disconnected |
| `option:added` | `{ surveyId, option }` | Neue Option |
| `option:updated` | `{ surveyId, option }` | Option bearbeitet |
| `option:removed` | `{ surveyId, optionId }` | Option gelöscht |
| `vote:received` | `{ surveyId, participantId }` | Jemand hat abgestimmt (ohne Wert!) |
| `vote:results-updated` | `{ surveyId, aggregatedResults }` | Aggregierte Ergebnisse |
| `objection:added` | `{ surveyId, objection }` | Neuer Einwand |
| `objection:status-changed` | `{ surveyId, objectionId, status }` | Einwand integriert/abgelehnt |

### 6.3 Hybrid-Ansatz

- **Mutationen immer über REST** (vorhersagbar, validierbar)
- **Socket.IO nur für Broadcasts** nach erfolgreicher REST-Mutation
- Controller → Service (DB-Write) → Socket.IO Emit
- `vote:received` zeigt nur *dass* jemand gestimmt hat, nicht *was* – Ergebnisse erst nach Phasenende

---

## 7. State Machine (Umfrage-Workflow)

### 7.1 Zustandsdiagramm

```
[entwurf] ──→ [optionen_sammeln] ──→ [abstimmen] ──→ [einwand_integration] ──→ [beendet]
                                          ↑                     │
                                          └─────────────────────┘
                                            (Re-Vote nach Integration)
```

Von `abstimmen` kann auch direkt zu `beendet` gewechselt werden (Einwand-Phase überspringen).

### 7.2 Erlaubte Übergänge

```typescript
const VALID_TRANSITIONS: Record<SurveyStatus, SurveyStatus[]> = {
  entwurf:               ['optionen_sammeln'],
  optionen_sammeln:      ['abstimmen'],
  abstimmen:             ['einwand_integration', 'beendet'],
  einwand_integration:   ['abstimmen', 'beendet'],
  beendet:               [],   // Terminal
};
```

### 7.3 Guard Conditions

| Übergang | Bedingung |
|----------|-----------|
| entwurf → optionen_sammeln | Titel und Voting-Methode müssen konfiguriert sein |
| optionen_sammeln → abstimmen | Mindestens 2 Optionen vorhanden |
| abstimmen → einwand_integration | Warnung wenn nicht alle abgestimmt haben (kein Block) |
| abstimmen → beendet | Host überspringt Einwand-Phase explizit |
| einwand_integration → abstimmen | Mind. 1 Einwand wurde integriert (neuer voting_round) |
| einwand_integration → beendet | Host beendet trotz/nach Einwänden |

### 7.4 Auto-Transition (Optional)

```typescript
interface AutoTransitionRules {
  optionen_sammeln_to_abstimmen?: {
    type: 'all_submitted';      // Wenn alle mind. 1 Option eingereicht haben
  } | {
    type: 'timer';
    minutes: number;
  };
  abstimmen_to_einwand?: {
    type: 'all_voted';          // Wenn alle abgestimmt haben
  };
}
```

Backend prüft Regeln per Polling (alle 30 Sekunden).

---

## 8. Authentifizierung

### 8.1 Registrierte Benutzer

- Registrierung: Username + Passwort → argon2id Hash → User in DB
- Login: Passwort verifizieren → JWT ausstellen (24h Gültigkeit)
- JWT in httpOnly Cookie (bevorzugt) + `Authorization: Bearer` Header als Fallback
- JWT Payload: `{ sub: userId, username: string, iat, exp }`

### 8.2 Anonyme Teilnehmer (Einladungslink)

1. Nutzer öffnet `/join/{inviteCode}`
2. Optional: Anzeigename eingeben
3. Backend erstellt `survey_participants` Eintrag mit `anonymous_token`
4. Token wird im localStorage gespeichert (Key: `participant_{surveyId}`)
5. Folge-Requests senden `X-Participant-Token` und `X-Survey-Id` Header

### 8.3 Upgrade: Anonym → Registriert

1. Anonymer Teilnehmer registriert sich normal
2. Frontend sendet `POST /auth/link-participant` mit `anonymousToken` + neuem JWT
3. Backend verknüpft: setzt `user_id` auf neuen User, löscht `anonymous_token`
4. Alle Votes, Optionen, Einwände bleiben erhalten (`participant_id` ändert sich nicht)

### 8.4 Middleware-Stack

- **`auth.ts`** (strict): JWT erforderlich, sonst 401
- **`optionalAuth.ts`**: Akzeptiert JWT *oder* Anonymous Token
- **`surveyRole.ts`**: Prüft Rolle des Teilnehmers in der spezifischen Umfrage

---

## 9. Rollen

| Rolle | Kontext | Berechtigungen |
|-------|---------|----------------|
| **Host** | Pro Umfrage (Ersteller) | Volle Kontrolle: Einstellungen, Phasen, Optionen verwalten, Einwände integrieren, Archivieren, Löschen |
| **Co-Host** | Pro Umfrage (vom Host ernannt) | Phasenübergänge, Optionen verwalten, Einwände reviewen |
| **Teilnehmer** | Pro Umfrage | Optionen einreichen, abstimmen, Einwände formulieren, Ergebnisse sehen |

---

## 10. Voting-Methoden

### 10.1 Widerstandsabfrage mit Punkteregel (`widerstand_punkte`)

- Skala: 0 (kein Widerstand) bis 10 (voller Widerstand) pro Option
- **Max pro Option**: Konfigurierbares Limit (Standard: 5 Punkte)
- **W-Max Budget**: Gesamtpunkte die ein Teilnehmer über alle Optionen verteilen darf
- UI: Interaktiver Slider mit Grün→Rot Farbverlauf + PointBudgetIndicator
- Server-seitige Validierung des Budgets bei Batch-Submit

### 10.2 Widerstandsabfrage (`widerstand`)

- Skala: 0-10 pro Option
- Keine Punktelimits
- UI: Slider mit Grün→Rot Farbverlauf

### 10.3 Mehrheitsentscheid (`mehrheit`)

- Einfaches Zustimmen oder Ablehnen pro Option
- Wert: 1 = Zustimmung, 0 = Ablehnung
- UI: Zustimmen/Ablehnen Buttons

---

## 11. Frontend-Architektur

### 11.1 Phasenabhängige Ansicht

Die Seite `/survey/[surveyId]` rendert je nach Phase und Rolle unterschiedliche Inhalte:

| Phase | Host-Ansicht | Teilnehmer-Ansicht |
|-------|-------------|-------------------|
| Entwurf | SurveySettingsForm | Warteanzeige |
| Optionen Sammeln | OptionList + OptionForm + Verwaltung | OptionList + OptionForm |
| Abstimmen | VotingView + Fortschrittsanzeige | VotingView |
| Einwand Integration | ObjectionReviewCard (Integration) | ObjectionForm |
| Beendet | ResultsView + Archivierung | ResultsView |

### 11.2 Echtzeit-Hook Pattern

```typescript
// useSurvey.ts Konzept:
// 1. Initial-Fetch via REST (Source of Truth)
// 2. Inkrementelle Updates via Socket.IO
// 3. State wird lokal aktualisiert (optimistic updates)
```

### 11.3 Charts

**Recharts** für Ergebnis-Visualisierungen:
- Balkendiagramme für Widerstandswerte pro Option
- Kreisdiagramme für Mehrheitsentscheid
- Responsive Container für mobile Darstellung

---

## 12. Docker-Konfiguration

### 12.1 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_PATH=/data/umfrage.db
      - CORS_ORIGIN=http://localhost:3000
      - PORT=3001
    volumes:
      - sqlite-data:/data
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:3001
        - NEXT_PUBLIC_WS_URL=ws://localhost:3001
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:3001
      - NEXT_PUBLIC_WS_URL=ws://backend:3001
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  sqlite-data:
```

### 12.2 Key Points

- **Multi-Stage Builds** für beide Services (Builder → Runner)
- **Named Volume** `sqlite-data` für SQLite-Persistenz über Container-Restarts hinweg
- **Internes Docker-Netzwerk**: Container kommunizieren über Service-Namen (`http://backend:3001`)
- Frontend SSR nutzt internes Netzwerk, Client-Side Calls nutzen `localhost:3001`

---

## 13. Sicherheit

| Bereich | Maßnahme |
|---------|----------|
| Passwörter | argon2id mit Standard-Cost-Parametern |
| JWT | 24h Gültigkeit, HS256, httpOnly Cookie |
| Anonymous Tokens | Kryptografisch zufällig (32 Bytes), gehasht in DB |
| SQL Injection | `better-sqlite3` nutzt ausschließlich parameterisierte Prepared Statements |
| XSS | React Default-Escaping + CSP Headers. Freitext wird als Text gerendert, nie als HTML |
| Input-Validierung | Zod-Schemas auf jedem Endpoint |
| Rate Limiting | Login: 5/15min, Register: 3/h, Join: 10/15min, General: 100/min |
| CORS | Explizite Origin-Konfiguration, Credentials erlaubt |
| HTTP Headers | Helmet Middleware |
| Invite-Code Brute-Force | 8+ Zeichen alphanumerisch (62^8 Kombinationen) + Rate Limiting |
| Vote-Manipulation | Server-seitige W-Max Budget-Validierung |
| Survey-Enumeration | UUIDs statt sequenzieller IDs, kein öffentliches Listing |

---

## 14. i18n-Strategie

- Start **nur Deutsch**
- Alle UI-Strings in `public/locales/de/common.json`
- Keine hartcodierten Strings in Komponenten
- Leichter Upgrade-Pfad: `next-intl` oder `next-i18next` hinzufügen wenn zweite Sprache benötigt

---

## 15. Implementierungsreihenfolge

| Phase | Bereich | Ergebnis |
|-------|---------|----------|
| 1 | Projekt-Scaffold | Monorepo, Docker Compose, leere Next.js + Express Apps die booten und kommunizieren |
| 2 | Datenbank + Auth | SQLite Schema, Migrations, Registrierung/Login, JWT Middleware |
| 3 | Survey CRUD | Erstellen/Lesen/Bearbeiten/Löschen von Umfragen, Dashboard, Invite-Code |
| 4 | State Machine | Phasenübergänge, PhaseController Komponente, Guard Conditions |
| 5 | Optionen | Hinzufügen/Bearbeiten/Löschen, OptionCollectionView, Echtzeit-Sync |
| 6 | Voting: Widerstand | ResistanceSlider, ResistanceVotePanel, Vote-Submit + Validierung |
| 7 | Voting: Mehrheit | MajorityVotePanel, Zustimmen/Ablehnen |
| 8 | Voting: Punkte | PointBudgetIndicator, W-Max Validierung (Client + Server) |
| 9 | Ergebnisse | ResultsChart, Aggregations-Queries, Auswertungs-Seite |
| 10 | Einwände | ObjectionForm, ObjectionReviewCard, Re-Vote Zyklus |
| 11 | Anonymer Beitritt | Invite-Link Flow, Anonymous Token Management, Upgrade-Pfad |
| 12 | Echtzeit | Socket.IO Integration über alle Features |
| 13 | Polish | Archiv-Modus, Responsive Design, Error Handling, Loading States |
| 14 | Docker Production | Multi-Stage Builds, Production Env Config, Health Checks |
