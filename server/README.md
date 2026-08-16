# NETS application server

The Vite app and `/api` routes run from one Node process. The server owns PIN
hashes, sessions, login throttling, recovery challenges and the synchronized
SQLite snapshot. Browser code never receives PIN hashes or session tokens.

## Required production configuration

- `NODE_ENV=production`
- `SESSION_SECRET`: at least 32 random bytes, kept outside source control
- `PORT`: optional, defaults to `5173`
- `NETS_DATA_FILE`: path on persistent encrypted storage
- `OTP_WEBHOOK_URL`: HTTPS endpoint that accepts the JSON SMS request
- `OTP_WEBHOOK_TOKEN`: optional bearer token for that endpoint
- `NETS_SEED_USERS_JSON`: initial production users, required only when the data
  store does not exist yet; keep it in the host secret manager

Run `npm run build` and then `npm start`. Terminate TLS at a trusted reverse
proxy and mount `NETS_DATA_FILE` on persistent storage. The included JSON store
is a deployable single-instance reference backend for this prototype; a real
banking rollout should replace it with an audited transactional database and an
approved identity/OTP provider.
