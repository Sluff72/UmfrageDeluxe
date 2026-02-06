# Security Vectors – Offene Prüfpunkte

Dieses Dokument sammelt potenzielle Sicherheitsrisiken, die zu einem späteren Zeitpunkt geprüft und adressiert werden müssen.

---

## 1. Co-Host Self-Promotion via Invite-Code

**Risiko:** Ein eingeloggter User, der den Invite-Code einer Umfrage kennt (aber nicht Teilnehmer ist), könnte sich selbst beitreten und – falls der Host ihn zum Co-Host befördert – Verwaltungsrechte erhalten. Das ist erwartetes Verhalten.

**Offene Frage:** Könnte ein eingeloggter User, der den `participantId` eines anderen Teilnehmers kennt, sich selbst zum Co-Host promoten, indem er direkt `PUT /api/surveys/:id/participants/:participantId/role` aufruft?

**Aktuelle Absicherung:** Der Endpoint prüft über `assertHost()`, ob der aufrufende User der Host ist. Nur der Host kann Rollen ändern. Das sollte sicher sein, aber muss explizit getestet werden:
- [ ] Testen: Normaler Teilnehmer ruft den Endpoint auf → sollte 403 zurückgeben
- [ ] Testen: Anonymer User ruft den Endpoint auf → sollte 401 zurückgeben (requireAuth)
- [ ] Testen: Co-Host ruft den Endpoint auf → sollte 403 zurückgeben (nur Host, nicht Co-Host)

**Priorität:** Mittel

---

## 2. Anonymous Token in Participant-Response

**Risiko:** `getParticipantsForSurvey()` nutzt `SELECT *`, was auch die Spalte `anonymous_token` zurückgibt. Dieses Token ist ein Geheimnis – wer es kennt, kann als der jeweilige anonyme Teilnehmer agieren.

**Aktuelle Situation:** Das Frontend nutzt das Feld nicht (es ist nicht im TypeScript-Interface). Aber es wird im JSON über die API mitgesendet und ist im Netzwerk-Traffic sichtbar.

**Maßnahme:** Das `anonymous_token` Feld sollte in der API-Antwort explizit ausgeschlossen werden (z.B. über ein DTO-Mapping oder `SELECT`-Spezifikation ohne `*`).

**Priorität:** Hoch

---

## 3. Survey-Detail Endpoint ohne Autorisierung

**Risiko:** `GET /api/surveys/:id` nutzt `optionalAuth` und gibt Survey-Details + Teilnehmerliste an jeden zurück, der die Survey-ID kennt. Survey-IDs sind UUIDs (nicht erratbar), aber trotzdem:

**Offene Frage:** Soll die Survey-Detail-Route prüfen, ob der Aufrufer Teilnehmer ist? Aktuell kann jeder mit der Survey-ID die Umfrage und alle Teilnehmer sehen.

**Abwägung:** Für den Join-Flow brauchen wir eine gewisse Offenheit. Aber die Teilnehmerliste (mit Namen) sollte ggf. nur für Teilnehmer sichtbar sein.

**Priorität:** Niedrig (UUIDs sind nicht erratbar, aber für sensible Umfragen relevant)

---

## 4. Rate Limiting

**Risiko:** Kein Rate Limiting auf API-Endpoints. Mögliche Angriffsvektoren:
- Brute-Force auf Login (`POST /api/auth/login`)
- Brute-Force auf Invite-Codes (`POST /api/surveys/join/:inviteCode`)
- Spam von Optionen oder Einwänden

**Maßnahme:** Rate Limiting Middleware hinzufügen (z.B. `express-rate-limit`).

**Priorität:** Mittel (vor Production-Deployment)

---

## 5. JWT Secret Management

**Risiko:** Das `JWT_SECRET` wird über `.env` geladen. Wenn es zu einfach ist oder versehentlich committed wird, können Tokens gefälscht werden.

**Maßnahme:**
- [ ] Sicherstellen, dass `.env` in `.gitignore` steht
- [ ] Mindestlänge für JWT_SECRET erzwingen
- [ ] Token-Expiration prüfen und ggf. verkürzen

**Priorität:** Hoch (vor Production-Deployment)
