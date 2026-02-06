# CLAUDE.md – Zusammenarbeitsrichtlinien

## Projekt

UmfrageDeluxe – Konsensorientiertes Online-Umfragetool mit widerstandsbasierter Abstimmung, Einwand-Integration und Phasen-Workflow.

## Tech Stack

- **Frontend**: Next.js (App Router) + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Datenbank**: SQLite (better-sqlite3)
- **Echtzeit**: Socket.IO
- **Containerisierung**: Docker + Docker Compose
- **Validierung**: Zod
- **Auth**: JWT + argon2id
- **Charts**: Recharts
- **Testing**: Vitest + React Testing Library

## Projektstruktur

```
/frontend     – Next.js App (Port 3000)
/backend      – Express API + Socket.IO (Port 3001)
/docker-compose.yml
/ARCHITECTURE.md  – Vollständiges Architekturdokument (Referenz für alle Entscheidungen)
```

## Zusammenarbeit

- **Iterativ**: Kleine Schritte – implementieren, reviewen, anpassen. Feature für Feature.
- **Ein Feature vollständig abschließen** bevor das nächste beginnt.
- **Bei Unklarheiten nachfragen** – lieber einmal zu viel fragen als falsch implementieren.
- **Klare Aufgaben direkt umsetzen** – kein unnötiger Planungsoverhead bei einfachen Tasks.
- **Änderungen erklären** – kurz begründen warum eine bestimmte Lösung gewählt wurde, wenn es Alternativen gibt.

## Coding-Konventionen

- **Sprache im Code**: Englisch (Variablen, Funktionen, Kommentare, Typen)
- **Sprache in der UI**: Deutsch (i18n-ready, Strings in `public/locales/de/common.json`)
- **TypeScript**: Strict Mode aktiviert
- **Validierung**: Zod-Schemas für alle API-Inputs (in `/backend/src/validators/`)
- **Architektur-Pattern**: Services enthalten Business-Logik, Controller nur HTTP-Handling
- **Echtzeit-Regel**: Keine Daten-Mutation über Socket.IO – nur REST. Sockets ausschließlich für Broadcasts.
- **IDs**: Hex-UUIDs (`lower(hex(randomblob(16)))`), keine sequenziellen IDs
- **Error Handling**: Custom Error Classes, konsistente JSON-Fehlerantworten

## Clean Code Prinzipien

- **Menschenlesbare Namen**: Funktionen, Variablen und Klassen sollen klar ausdrücken was sie tun. `calculateTotalResistanceScore()` statt `calcScore()`, `surveyParticipant` statt `sp`.
- **Single Responsibility**: Jede Klasse/Modul hat genau eine Verantwortung. Services trennen sich nach Domäne (SurveyService, VoteService, etc.).
- **Kleine Funktionen**: Funktionen tun eine Sache und tun sie gut. Wenn eine Funktion einen Kommentar braucht um zu erklären *was* sie tut, ist sie zu komplex – aufteilen.
- **Aussagekräftige Abstraktionen**: Module und Klassen so schneiden, dass sie für sich allein verständlich sind. Abhängigkeiten explizit über Constructor Injection / Parameter.
- **Keine Magic Numbers/Strings**: Konstanten mit sprechenden Namen extrahieren.
- **DRY mit Augenmaß**: Duplikation vermeiden, aber nicht auf Kosten der Lesbarkeit. Zwei ähnliche Stellen sind OK – drei bedeuten: extrahieren.

## Commit-Stil

- Konventionelle Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- Deutsche oder englische Commit-Messages – beides OK
- Beispiel: `feat: add resistance slider component`

## Testen

- **Implementieren und Testen gehören zusammen** – der kritische Pfad jedes Features muss durch Tests abgedeckt sein
- Backend: Vitest für Unit-Tests der Services und Middleware
- Frontend: Vitest + React Testing Library für Komponenten-Tests
- Vor Abschluss eines Features: Tests müssen grün sein und `npm run build` muss in beiden Projekten erfolgreich sein

## Git-Workflow

- **Feature-Branches**: Jedes Feature wird in einem eigenen Branch entwickelt (`feat/survey-crud`, `feat/voting-resistance`, etc.)
- **Pull Requests**: Feature-Branch → `preprod` (Review + Merge via PR)
- **Release**: `preprod` → `main` (Merge wenn stabil)
- Branch-Namenskonvention: `feat/`, `fix/`, `refactor/`, `chore/` + kurze Beschreibung

## Wichtige Architektur-Entscheidungen

Vollständige Details in `ARCHITECTURE.md`. Kurzfassung:

- **`survey_participants`** ist die zentrale Identitätstabelle (registrierte User + anonyme Teilnehmer)
- **`voting_round`** ermöglicht Re-Votes nach Einwand-Integration
- **`optionalAuth` Middleware** bedient registrierte und anonyme User transparent
- **State Machine** in `stateMachine.service.ts` steuert alle Phasenübergänge mit Guard Conditions
- **Hybrid REST + Socket.IO**: Mutationen über REST, Broadcasts über Socket.IO

## Umfrage-Phasen (Referenz)

```
Entwurf → Optionen Sammeln → Abstimmen → Einwand Integration → Beendet
                                  ↑                │
                                  └────────────────┘  (Re-Vote)
```

## Rollen pro Umfrage

- **Host**: Ersteller, volle Kontrolle
- **Co-Host**: Verwaltung unterstützen (Phasen, Optionen, Einwände)
- **Teilnehmer**: Optionen einreichen, abstimmen, Einwände formulieren
