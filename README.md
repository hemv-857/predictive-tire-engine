# Predictive Tire Performance & Strategy Engine

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-live-brightgreen)](https://predictive-tire-engine.vercel.app)
[![CI](https://github.com/hemv-857/predictive-tire-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/hemv-857/predictive-tire-engine/actions)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

> Real-time tire degradation ML model, pit stop decision support, and competitive benchmarking dashboard for the **Apex Racing F1 team**.

---

## Features

- **Physics-Informed ML Model** — Tire degradation prediction with multi-class classification (optimal/warning/critical)
- **Live Telemetry** — WebSocket streaming from a race simulator (5 drivers, 58-lap Monaco GP loop)
- **Pit Strategy Dashboard** — 18-tab D3.js dashboard with degradation curves, pit windows, sector analysis
- **Competitor Intel** — Team strategy patterns, circuit heatmaps, head-to-head comparisons
- **Model Ops** — SHAP feature importance, training history, drift monitoring
- **Championship Tracking** — Drivers' & Constructors' standings

---

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

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Prisma + SQLite |
| Charts | D3.js, Recharts |
| State | Zustand |
| Real-time | Socket.io (port 3003) |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.2 or Node.js >= 20

### Setup

```bash
git clone https://github.com/hemv-857/predictive-tire-engine.git
cd predictive-tire-engine

bun install
bun run db:generate
bunx tsx scripts/seed.ts

bun run dev
```

Open **http://localhost:3000**.

### Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=file:./db/custom.db
```

---

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js Dashboard | 3000 | Main UI, API routes, Prisma ORM |
| Telemetry Simulator | 3003 | Socket.io live race telemetry |
| ML Prediction | 3004 | Tire degradation model + pit-window solver |
| Caddy Gateway | 81 | Reverse proxy, WebSocket routing |

---

## ML Model

Physics-informed deterministic formula:

```
lapsFactor = (tireAge / expectedLife) ^ 1.4
basePerf = 1 - compoundDeg × lapsFactor
penalties = tempPenalty + slipPenalty + fuelPenalty + trackTempPenalty
predictedPerf = clamp(basePerf - penalties, 0.45, 1.0)
```

**Compounds**: Soft (18 laps, 0.045 deg), Medium (28 laps, 0.028), Hard (40 laps, 0.017)

**Classes**: optimal (>=0.95), warning_95 (0.90-0.95), warning_90 (0.85-0.90), warning_85 (0.80-0.85), critical (<0.80)

**Endpoints**:
- `POST /predict` — single-lap prediction with confidence interval
- `POST /pit-window` — solves for lap where perf < 0.90
- `GET /model/status` — version, metrics, feature list

---

## Dashboard Tabs (18)

| Tab | Purpose |
|-----|---------|
| Command | KPIs, model accuracy trend, race weekend status |
| Live | Real-time AI recommendations for Apex drivers |
| Degradation | 4-corner tire temps/pressures, performance trajectory |
| Thermal | 4-corner temperature heatmap + distribution |
| Pit Strategy | ML recommendation, forecast chart, decision log |
| Pit Performance | Timing error analysis, driver/race breakdown |
| Simulator | What-if strategy builder |
| Head-to-Head | Driver vs driver comparison |
| Compare | All 10 drivers' strategies side-by-side |
| Delta Matrix | Lap-time delta heatmap |
| Sector | Sector 1/2/3 breakdown |
| Explorer | Multi-channel telemetry scrubber |
| Lifecycle | Stint-by-stint tire usage timeline |
| Weather | Track temp/humidity impact |
| Competitors | Team strategy patterns |
| Drift | Model drift monitoring |
| Standings | Championship standings |
| Model Ops | Model metadata, SHAP importance, training history |

---

## Database

8 Prisma models: `Race`, `Driver`, `TireCompound`, `Telemetry`, `TireModel`, `PitDecision`, `PredictionLog`, `CompetitorStrategy`, `WeeklyBrief`.

Seeded with: 6 races, 10 drivers, 5 compounds, ~3,160 telemetry records, 50 pit decisions, 250 predictions, 54 competitor strategies.

---

## License

MIT — see [LICENSE](LICENSE).
