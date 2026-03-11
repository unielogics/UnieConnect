# UnieConnect Dev Setup – Reliable Auth & Connect

## Quick start (both services)

1. **Start UnieConnectBackend** (port 4001):
   ```bash
   cd UnieConnectBackend
   npm run dev
   ```
   Ensure `.env` has `PORT=4001` (or leave default; backend uses 4000/4001 from env).

2. **Start UnieConnect frontend** (port 3000):
   ```bash
   cd UnieConnect
   npm run dev
   ```

3. Open http://localhost:3000, log in, then go to **Connect to warehouse** and enter code `NJ-472221`.

## How auth works

- Browser sends requests to `localhost:3000/api/v1/*` (same-origin).
- The custom API proxy at `pages/api/v1/[...path].ts` forwards them to the backend with `Authorization` and other headers.
- Next.js rewrites do *not* forward auth headers; this proxy does.

## Required env (UnieConnectBackend)

- `AUTH_SECRET` – used to sign JWTs (e.g. `change-me` for dev). **Required** – missing or changed value causes 401.
- `DB_URL` – MongoDB connection string. **Required** for auth – users live in UnieConnectBackend’s DB.
- `WMS_API_URL` – UnieBackend base URL (e.g. `http://localhost:8000`). Required for connect flow.
- `UNIECONNECT_INTERNAL_API_KEY` – must match UnieBackend; required for connect flow.

## Required env (UnieBackend)

- `MONGODB_URI` or `WAREHOUSE_CONNECTION_URI` – central DB where `Warehouse`, `OmsIntermediary`, etc. live.
- `UNIECONNECT_INTERNAL_API_KEY` – must match UnieConnectBackend; required for internal /internal/oms/connect.

## Config checklist for Connect flow

| Component | Env | Purpose |
|-----------|-----|---------|
| UnieConnectBackend | `WMS_API_URL` | Proxy connect requests to UnieBackend |
| UnieConnectBackend | `UNIECONNECT_INTERNAL_API_KEY` | Auth for internal API calls |
| UnieBackend | `UNIECONNECT_INTERNAL_API_KEY` | Validate internal API key |
| UnieBackend | `WAREHOUSE_CONNECTION_URI` or `MONGODB_URI` | Central DB (warehouses, omsConnectionId) |

## Connection code

Connection code format: `STATE-6digits` (e.g. `NJ-472221`, `CA-847291`).

Run in UnieBackend to seed code `NJ-472221` on first warehouse:

```bash
cd UnieBackend
npm run seed:oms-connection-code
```

To backfill connection codes for existing warehouses missing `omsConnectionId`:

```bash
cd UnieBackend
npm run backfill:oms-connection-code
```

## Troubleshooting 401 Unauthorized

### Checklist

1. **Logged in?** Ensure you completed login and have a token in `localStorage` (DevTools → Application → Local Storage, key `unie-token`).
2. **AUTH_SECRET** – UnieConnectBackend must have `AUTH_SECRET` set. It signs login JWTs; if it changes, existing tokens become invalid. Default for dev: `change-me`.
3. **DB_URL** – UnieConnectBackend needs MongoDB. Users are stored in UnieConnectBackend’s DB, not UnieWMS.
4. **Backend running** – UnieConnectBackend must be running (e.g. port 4001). The frontend proxy forwards to `UNIECONNECT_BACKEND_URL` or `http://localhost:4001`.

### Test auth (PowerShell)

**Important:** `Invoke-WebRequest` often omits the `Authorization` header. Prefer `curl.exe`:

```powershell
curl.exe -X GET "http://localhost:4001/api/v1/user/features" -H "Authorization: Bearer YOUR_ACTUAL_TOKEN"
```

Or run the backend test script (uses the real fetch API, which sends headers correctly):

```powershell
cd UnieConnectBackend
$env:UC_TEST_PASSWORD = "your_password"
$env:UC_TEST_EMAIL = "franco@unielogics.com"
node scripts/test-auth.mjs
```

Use the real JWT from `localStorage` (Application tab), not the placeholder `YOUR_TOKEN_HERE`.

### If 401 persists

- Log out and log in again to refresh the token.
- Confirm `AUTH_SECRET` in UnieConnectBackend `.env` matches the value used when the token was issued.
