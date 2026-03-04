# Sicherheitscheck: UmfrageDeluxe

Datum: 2026-02-07  
Umfang: Statischer Code-/Konfigurations-Review von Backend, Frontend, Docker/Caddy und Auth-Flow.

## Executive Summary

Der größte Risikobereich ist aktuell die Zugriffskontrolle auf Survey-Daten (IDOR/fehlende Autorisierung bei mehreren `GET`-Endpunkten) sowie der ungeschützte Socket-Join. Dadurch können Dritte bei Kenntnis einer `surveyId` sensible Inhalte (Teilnehmerliste, Einwände inkl. Autoren, Ergebnisse) auslesen und Live-Events mitlauschen.

Zusätzlich erhöhen Client-seitige Token-Speicherung in `localStorage` und eine potenzielle Open-Redirect-Stelle im Login den Angriffsraum.

## Befunde (priorisiert)

### 1) Hoch: Fehlende Autorisierung bei mehreren Lese-Endpunkten (IDOR / Data Exposure)

**Risiko:** Vertrauliche Umfragedaten können ohne Teilnehmerberechtigung gelesen werden, wenn eine `surveyId` bekannt ist.

**Code-Hinweise:**
- `backend/src/routes/survey.routes.ts:33` (`GET /surveys/:id` mit `optionalAuth`)
- `backend/src/controllers/survey.controller.ts:36`
- `backend/src/routes/option.routes.ts:10` (`GET /surveys/:id/options` mit `optionalAuth`)
- `backend/src/routes/vote.routes.ts:35` (`GET /surveys/:id/results` mit `optionalAuth`)
- `backend/src/routes/objection.routes.ts:19` (`GET /surveys/:id/objections` mit `optionalAuth`)
- `backend/src/services/vote.service.ts:130` (liefert Einwände inkl. `author_name`)
- `backend/src/services/objection.service.ts:50` (liefert alle Einwände pro Survey)

**Impact:** Offenlegung von Survey-Metadaten, Teilnehmern, Einwänden und Aggregaten; Datenschutz- und Vertrauensrisiko.

**Empfehlung:**
- Für alle oben genannten Read-Endpunkte: Zugriff nur für echte Teilnehmer erlauben.
- Einheitliche Middleware einführen, z.B. `requireSurveyParticipant` (JWT oder gültiger `x-participant-token` für genau diese Survey).
- Für Ergebnisse/Einwände ggf. feingranular differenzieren (z.B. nur nach bestimmter Phase oder Rolle).

---

### 2) Hoch: Socket.IO-Räume ohne Auth/Autorisierung beitretbar

**Risiko:** Jeder Client kann `SURVEY_JOIN` mit beliebiger `surveyId` senden und in den Raum eintreten.

**Code-Hinweise:**
- `backend/src/socket/index.ts:19` bis `backend/src/socket/index.ts:23`

**Impact:** Unautorisierte Echtzeit-Einsicht in Phasenwechsel, Optionen, Abstimmungsereignisse, Einwand-Updates, Rollenänderungen.

**Empfehlung:**
- Socket-Authentifizierung beim Handshake (JWT oder anonymes Survey-Token).
- Vor `socket.join(room)` serverseitig Teilnehmerstatus für die Survey prüfen.
- Optional: Rooms mit signierten, kurzlebigen Join-Tokens absichern.

---

### 3) Hoch: `allow_anonymous` wird beim Join nicht erzwungen

**Risiko:** Auch bei deaktivierter anonymer Teilnahme können anonyme Teilnehmer beitreten.

**Code-Hinweise:**
- `backend/src/services/survey.service.ts:196` ff.
- In `joinSurveyByInviteCode(...)` fehlt ein Check auf `survey.allow_anonymous`, bevor ohne `userId` ein Teilnehmer angelegt wird.

**Impact:** Umgehung der gewünschten Zugangspolitik der Umfrage.

**Empfehlung:**
- Bei `userId === null` und `allow_anonymous === false` mit `403` ablehnen.
- Testfälle ergänzen: anonymer Join bei deaktivierter Option muss fehlschlagen.

---

### 4) Mittel: JWT liegt im Browser-`localStorage` (zusätzlich zu HttpOnly-Cookie)

**Risiko:** Bei XSS ist Token-Exfiltration trivial.

**Code-Hinweise:**
- `frontend/src/contexts/AuthContext.tsx:35`, `:52`, `:67`
- `frontend/src/lib/api.ts:26` bis `:40`
- Backend setzt ohnehin ein HttpOnly-Cookie: `backend/src/controllers/auth.controller.ts:22`

**Impact:** Kontoübernahme bei erfolgreicher XSS deutlich einfacher und langlebiger.

**Empfehlung:**
- Bevorzugt rein cookie-basierte Session (HttpOnly, Secure, SameSite) verwenden.
- Token nicht mehr an Frontend zurückgeben oder nicht persistent speichern.
- Falls Bearer-Token nötig: sehr kurze TTL + Refresh-Strategie + CSP/XSS-Härtung.

---

### 5) Mittel: Potenzieller Open Redirect nach Login

**Risiko:** `redirect`-Query wird ungeprüft an `router.push(...)` übergeben.

**Code-Hinweise:**
- `frontend/src/app/login/page.tsx:25` bis `:26`

**Impact:** Phishing-/Weiterleitungsrisiko (abhängig vom Routing-/URL-Handling).

**Empfehlung:**
- Nur relative interne Pfade erlauben (`/^\/(?!\/)/`).
- Fallback immer auf `/dashboard`.

---

### 6) Mittel: Unsicherer Secret-Fallback in `docker-compose.yml`

**Risiko:** Bei fehlender Umgebungsvariable läuft Backend mit bekanntem Default-Secret.

**Code-Hinweise:**
- `docker-compose.yml:10` (`JWT_SECRET=${JWT_SECRET:-dev-secret-change-in-production}`)

**Impact:** Token-Fälschung in fehlkonfigurierten Deployments möglich.

**Empfehlung:**
- Auch im Standard-Compose `JWT_SECRET` verpflichtend machen (`${JWT_SECRET:?required}`).
- Deployment-Checks (Start verweigern ohne Secret).

## Ergänzende Beobachtungen

- Positiv: SQL wird konsistent mit parametrisierten Statements verwendet (reduziertes SQLi-Risiko).
- Positiv: `helmet()` ist aktiv und grundlegende Rate-Limits sind vorhanden.
- Positiv: Produktions-Compose (`docker-compose.prod.yml`) erzwingt `JWT_SECRET` bereits korrekt.
- Hinweis: `npm audit` konnte in dieser Umgebung nicht ausgeführt werden (kein DNS/Internet zu `registry.npmjs.org`).

## Priorisierter Maßnahmenplan

1. **Sofort (P0/P1):**
- Autorisierung für alle Survey-Read-Endpunkte erzwingen.
- Socket-Join nur nach serverseitiger Berechtigungsprüfung zulassen.
- `allow_anonymous` beim Join strikt durchsetzen.

2. **Kurzfristig (P1/P2):**
- Login-Redirect hart validieren (nur interne Pfade).
- JWT-Handling vereinfachen: `localStorage`-Token entfernen, Cookie-only nutzen.
- `docker-compose.yml` auf verpflichtendes Secret umstellen.

3. **Mittelfristig (P2):**
- Security-Regression-Tests (API + Socket) für alle oben genannten Fälle.
- Optional: dedizierte Rate-Limits für Join-/Survey-Discovery-Endpunkte.

## Testfälle zur Absicherung (sollten automatisiert werden)

- Nicht-Teilnehmer ruft `GET /api/surveys/:id` auf -> `403`.
- Nicht-Teilnehmer ruft `GET /api/surveys/:id/results` auf -> `403`.
- Nicht-Teilnehmer ruft `GET /api/surveys/:id/objections` auf -> `403`.
- Socket ohne gültige Zugehörigkeit sendet `SURVEY_JOIN` -> Join wird verweigert.
- Anonymer Join bei `allow_anonymous=false` -> `403`.
- Login mit `?redirect=https://evil.example` -> Redirect wird verworfen, Ziel `/dashboard`.
