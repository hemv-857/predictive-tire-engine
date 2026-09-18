# Predictive Tire Performance & Strategy Engine

**Apex Racing F1** — Real-time tire degradation ML model, pit stop decision support, and competitive benchmarking dashboard.

## Overview

This project is a complete Formula 1 tire strategy platform built for the Apex Racing team. It combines:

- **Physics-informed ML model** — tire degradation prediction with multi-class classification (optimal/warning/critical)
- **Live telemetry ingestion** — WebSocket streaming from a race simulator (5 drivers, 58-lap Monaco GP loop)
- **Pit strategy dashboard** — 18-tab D3.js dashboard with degradation curves, pit windows, sector analysis, competitor intel
- **Mini-services architecture** — decoupled TypeScript services for ML inference (port 3004) and telemetry (port 3003)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Telemetry      │────▶│  Next.js App     │◀───│  ML Prediction   │
│  Service        │WS   │  (Dashboard)     │HTTP │  Service         │
│  (port 3003)    │     │  (port 3000)     │     │  (port 3004)     │
└─────────────────┘     └────────┬─────────┘     └──────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             ┌─────────────┐           ┌─────────────┐
             │  SQLite DB  │           │  Caddy      │
             │  (Prisma)   │           │  Gateway    │
             └─────────────┘           │  (port 81)  │
                                       └─────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+ / Bun 1.0+
- Git

### Local Development
```bash
# Clone and install
git clone https://github.com/hemv-857/predictive-tire-engine.git
cd predictive-tire-engine
bun install

# Generate Prisma client
bun run db:generate

# Seed database with F1 data
bunx tsx scripts/seed.ts

# Start all services (3 terminals)
# Terminal 1: Next.js dashboard
bun run dev

# Terminal 2: Telemetry WebSocket service
cd mini-services/telemetry-service && bun run dev

# Terminal 3: ML prediction service
cd mini-services/ml-prediction-service && bun run dev

# Access dashboard at http://localhost:3000
# Or via Caddy gateway at http://localhost:81
```

### Using Caddy Gateway (production-style)
```bash
# Start Caddy (proxies /socket.io/* → 3003, rest → 3000)
caddy run --config Caddyfile
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js Dashboard | 3000 | Main UI, API routes, Prisma ORM |
| Telemetry Simulator | 3003 | Socket.io live race telemetry (5 drivers) |
| ML Prediction | 3004 | Tire degradation model + pit-window solver |
| Caddy Gateway | 81 | Reverse proxy, WebSocket routing |

## Dashboard Tabs (18)

| Tab | Purpose |
|-----|---------|
| **Command** | KPIs, model accuracy trend, race weekend status, weekly brief |
| **Live** | Real-time AI recommendations for Apex drivers |
| **Degradation** | 4-corner tire temps/pressures, performance trajectory, compound comparison |
| **Thermal** | 4-corner temperature heatmap + distribution histogram |
| **Pit Strategy** | ML recommendation banner, forecast chart, pit-window confidence, decision log |
| **Pit Performance** | Timing error analysis, driver/race breakdown |
| **Simulator** | What-if strategy builder with lap-time projection |
| **Head-to-Head** | Driver vs driver lap/sector/performance comparison |
| **Compare** | All 10 drivers' strategies side-by-side |
| **Delta Matrix** | Lap-time delta heatmap (all drivers × all laps) |
| **Sector** | Sector 1/2/3 breakdown, fastest sectors, lap-by-lap leaders |
| **Explorer** | Multi-channel telemetry scrubber (temps, pressures, slip, brakes) |
| **Lifecycle** | Stint-by-stint tire usage timeline |
| **Weather** | Track temp/humidity impact on performance |
| **Competitors** | Team strategy patterns, circuit heatmaps |
| **Drift** | Model drift monitoring (MAE vs baseline) |
| **Standings** | Drivers' & Constructors' championship |
| **Model Ops** | Model metadata, SHAP feature importance, training history |

## ML Model

The tire degradation model is a **physics-informed deterministic formula** (not a trained neural net):

```
lapsFactor = (tireAge / expectedLife) ^ 1.4
basePerf = 1 - compoundDeg × lapsFactor
penalties = tempPenalty + slipPenalty + fuelPenalty + trackTempPenalty
predictedPerf = clamp(basePerf - penalties, 0.45, 1.0)
```

**Compounds**: Soft (18 laps, 0.045 deg), Medium (28 laps, 0.028), Hard (40 laps, 0.017)

**Classes**: optimal (≥0.95), warning_95 (0.90-0.95), warning_90 (0.85-0.90), warning_85 (0.80-0.85), critical (<0.80)

**Endpoints**:
- `POST /predict` — single-lap prediction with confidence interval
- `POST /pit-window` — solves for lap where perf < 0.90
- `GET /model/status` — version, hardcoded metrics, feature list
- `GET /model/feature-importance` — SHAP-like rankings
- `GET /model/training-history` — version history

> ⚠️ **Note**: Model "accuracy" (0.892) is a hardcoded constant in the ML service, not measured on test data.

## Database Schema (Prisma)

8 models: `Race`, `Driver`, `TireCompound`, `Telemetry` (16 fields/lap), `TireModel`, `PitDecision`, `PredictionLog`, `CompetitorStrategy`, `WeeklyBrief`.

Seeded with: 6 races, 10 drivers, 5 compounds, ~3,160 telemetry records, 5 model versions, 50 pit decisions, 250 predictions, 54 competitor strategies.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- **Lint & Typecheck** — `eslint` + `tsc --noEmit`
- **Tests** — database-runtime-build + python-runtime-build shell tests
- **Build** — `bun run db:generate` + `bun run build`
- **Docker** — builds image on main branch
- **Deploy Preview** — placeholder for PR deployments

## Project Structure

```
├── .github/workflows/ci.yml
├── Caddyfile
├── prisma/schema.prisma
├── scripts/seed.ts
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # 38 API routes
│   │   ├── page.tsx           # Dashboard shell
│   │   └── layout.tsx
│   ├── components/
│   │   ├── charts/            # D3 chart components
│   │   └── dashboard/         # 18 tab components
│   ├── hooks/                 # React hooks
│   └── lib/                   # DB, types, utils, socket hook
├── mini-services/
│   ├── telemetry-service/     # Bun + Socket.io (port 3003)
│   └── ml-prediction-service/ # Bun HTTP (port 3004)
└── tests/
    ├── database-runtime-build.sh
    ├── python-runtime-build.sh
    └── python-runtime-container.sh
```

## Known Limitations

- No authentication on API routes (demo only)
- ML model metrics are hardcoded, not evaluated
- Pit-window solver uses tire-age vs race-lap mismatch after stops
- No migration history — deploys use `prisma db push --accept-data-loss`
- ~25 unused dependencies in package.json
- Bootstrap dead-screen if `/api/dashboard` fails

## License

MIT — see individual service `package.json` files.