# Backend API

Express + TypeScript backend for bullion assets.

## Stack

- Node.js + Express
- MongoDB (optional connection)
- Redis (optional cache)
- Zod validation

## Run

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Local infra ports

- MongoDB expected at `mongodb://localhost:27019/sggold`
- Redis expected at `redis://localhost:6381`

## Alpha Vantage

- `DATA_PROVIDER_MODE=alpha_vantage`
- `ALPHA_VANTAGE_API_KEY=<your_key>`

If Alpha Vantage is unavailable or rate-limited, service falls back to mock provider.

Recommended free-tier settings:

- `LIVE_CACHE_TTL_SECONDS=3600`
- `HISTORICAL_CACHE_TTL_SECONDS=86400`
