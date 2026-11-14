# Pairing (6-digit) + accounts — contract

## Goal
One-time pairing: watch shows a **6-digit numeric code**; user **creates/logs into an account on the web** and enters the code to link the watch. After pairing, watch stores credentials locally and syncs telemetry without repeating pairing.

## IDs
- `deviceId`: UUID generated once on watch, persisted (DataStore).
- `crewMemberId`: string assigned at claim time (e.g. `USR-{userId short}-{n}` or user-chosen display id).
- Web auth: **JWT** in httpOnly cookie or `Authorization: Bearer` (prefer Bearer for SPA simplicity).

## API (all under existing host; ingest paths stay compatible)

### Auth (web)
- `POST /api/auth/register` `{ email, password, displayName? }` → `{ token, user }`
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` (Bearer) → user + linked devices

### Pairing
- `POST /api/pairing/code` (no auth) `{ deviceId }` → `{ code: "123456", expiresAt, ttlSeconds }`
  - Code: 6 digits, cryptographically random or secure random 100000–999999, unique while active.
  - TTL: 10 minutes; new request invalidates previous code for same `deviceId`.
- `GET /api/pairing/status?deviceId=` (no auth) → `{ status: "pending"|"paired"|"expired", crewMemberId?, deviceToken? }`
  - When `paired`, include **deviceToken** (opaque, long-lived) for watch API calls.
- `POST /api/pairing/claim` (Bearer) `{ code }` → `{ crewMemberId, deviceId }`
  - Binds device to authenticated user; marks code consumed.

### Watch-authenticated sync (after pairing)
- Option A: existing `POST /api/profile` and `POST /api/telemetry/batch` accept header `X-Device-Token: <token>` and resolve `crewMemberId` from token (ignore body crewMemberId mismatch).
- Option B: keep body `crewMemberId` but require valid device token matching that crew member.

## Web UI
- `/register`, `/login`
- After login: dashboard + **“Vincular reloj”** — input 6 digits, submit claim
- Show linked devices on dashboard

## Wear OS
- If no `deviceToken` in secure storage: show **PairingScreen** with large 6-digit code, refresh on expiry, poll status every 2–3s until paired
- On paired: save `deviceToken`, `crewMemberId`, set `onboardingComplete` / skip duplicate onboarding if needed
- Retrofit: add interceptor for `X-Device-Token`; use stored `crewMemberId` in sync DTOs
- Pairing is **once** unless user clears app data

## Backend storage (SQLite)
- `users`, `devices`, `pairing_codes` (+ migrations or init in existing db layer)
- Use bcrypt for passwords; hash device tokens at rest

## Non-goals (v1)
- OAuth social login
- Multi-watch per account beyond listing devices (support multiple devices OK)

## Integration notes
- Repo: `/home/vmcode/AndroidStudioProjects/RaHel`
- Production API base: `https://rahel.hermesbackend.xyz/api/`
- Do not add AI attribution to commits.


## Cambios de seguridad (revisión de auditoría)

Variables de entorno nuevas: `RAHEL_JWT_SECRET` (obligatoria en producción), `RAHEL_CORS_ORIGINS`, `RAHEL_TRUST_PROXY`, `RAHEL_ALLOW_LEGACY_INGEST` (solo dev). Ver `backend/README.md`.

### Pairing
- `deviceId`: debe cumplir `^[A-Za-z0-9_-]{16,128}$` (un UUID sirve). Actúa como secreto del reloj; no está firmado por el servidor.
- El código sigue siendo de **6 dígitos** (+ `secondaryCode` de 6 dígitos, derivado con HMAC del secreto del servidor), TTL 10 min, con rate limit por IP y bloqueo por usuario (5 fallos => 15 min, `429 claim_locked`).
- `GET /api/pairing/status?deviceId=` es público pero **ya no devuelve `code`/`secondaryCode`**: responde `{status:"pending"}`, `{status:"expired"}` o `{status:"paired", crewMemberId, deviceToken?}`. El `deviceToken` se entrega **una sola vez**; después se borra de `device_token_pending`. Se guarda cifrado (AES-256-GCM, clave derivada de `RAHEL_JWT_SECRET`), TTL 5 min y limpieza periódica.
- `POST /api/pairing/claim`: transacción con `UPDATE` condicional (`changes===1`, si no `409 code_already_used`). Si el dispositivo ya pertenece a otro usuario y el reloj no ha emitido un código posterior: `409 device_already_paired`. Un nuevo propietario recibe un `crewMemberId` nuevo (no hereda histórico). Re-vincular con el mismo usuario conserva el `crewMemberId` y rota el token.
- `DELETE /api/pairing/devices/:deviceId` (Bearer, propietario): revoca el token (`200 {revoked:true}`; `404 device_not_found` si no existe o no es suyo). El reloj recibirá 401 en la siguiente sincronización y deberá re-emparejarse.
- Errores de claim: `code_not_found` 404, `code_expired` 410, `code_already_used` 409, `device_already_paired` 409, `claim_locked` 429.

### Ingesta y lectura
- Ingesta (`/profile`, `/telemetry/batch`): requiere `X-Device-Token`; `crewMemberId` del body se ignora. 401 `{error:"unauthorized"}` si falta/inválido/revocado.
- Lectura (`/api/crew`, `/latest`, `/readings`, `/assessment/latest`): Bearer JWT, solo dispositivos propios. Todos los 401 devuelven `{error:"unauthorized"}`.
- Vitales nulables en `SensorReadingDto` (`null` = sin dato, no 0).
