# UmfrageDeluxe

Konsensorientiertes Online-Umfragetool mit widerstandsbasierter Abstimmung, Einwand-Integration und Phasen-Workflow.

Statt klassischer Mehrheitsentscheide misst UmfrageDeluxe den **Widerstand** der Teilnehmenden gegen jede Option (Systemisches Konsensieren). Einwände können formuliert und in die Optionen integriert werden, danach ist ein Re-Vote möglich – bis die Gruppe eine tragfähige Entscheidung gefunden hat.

## Features

- **Widerstandsbasierte Abstimmung**: Bewertung von 0 (kein Widerstand) bis 10 (maximaler Widerstand) pro Option
- **Phasen-Workflow**: Entwurf → Optionen sammeln → Abstimmen → Einwand-Integration → Beendet (mit Re-Vote-Schleife)
- **Anonyme Teilnahme**: Teilnehmende brauchen kein Konto – Beitritt per Link oder QR-Code
- **Rollen**: Host, Co-Host und Teilnehmer:innen pro Umfrage
- **Echtzeit-Updates**: Live-Abstimmungsfortschritt und Ergebnisse via Socket.IO

## Tech Stack

- **Frontend**: Next.js (App Router) + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Datenbank**: SQLite (better-sqlite3)
- **Echtzeit**: Socket.IO
- **Containerisierung**: Docker + Docker Compose

## Installation & Hosting

Die vollständige Anleitung für lokale Entwicklung, Docker-Setup und Production-Deployment (inkl. Reverse Proxy und Backups) steht in **[INSTALL.md](INSTALL.md)**.

Kurzfassung für die lokale Entwicklung:

```bash
# Backend (Port 3001)
cd backend/ && npm install && npm run dev

# Frontend (Port 3000, in neuem Terminal)
cd frontend/ && npm install && npm run dev
```

## Tests

```bash
cd backend/ && npm test
```

## Lizenz

UmfrageDeluxe ist freie Software, lizenziert unter der **GNU Affero General Public License v3.0 oder später (AGPL-3.0-or-later)**. Der vollständige Lizenztext steht in [LICENSE](LICENSE).

Das bedeutet insbesondere:

- Du darfst die Software nutzen, verändern und weitergeben – auch kommerziell.
- Wer eine veränderte Version **weitergibt oder als Netzwerkdienst betreibt** (z.B. öffentlich hostet), muss den vollständigen Quellcode dieser Version unter derselben Lizenz zugänglich machen (AGPL §13).
- Die eingebauten Copyright- und Lizenzhinweise (u.a. der Quellcode-Link im Footer der App) müssen erhalten bleiben.

Copyright (C) 2026 Heinz Brasch

## Transparenzhinweis: KI-generierte Inhalte

Dieses Projekt wurde **agentisch codiert**: Der Quellcode wurde in wesentlichen Teilen mithilfe von KI-Assistenten (Claude / Claude Code von Anthropic) unter menschlicher Anleitung und Review von Heinz Brasch entwickelt. Auch diese Dokumentation sowie [INSTALL.md](INSTALL.md) wurden KI-generiert und anschließend menschlich geprüft.

Dieser Hinweis dient der Kenntlichmachung KI-generierter Inhalte im Sinne der Transparenzanforderungen der EU-KI-Verordnung (EU AI Act, Verordnung (EU) 2024/1689).
