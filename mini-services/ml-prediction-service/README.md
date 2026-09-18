# ML Prediction Service

Mini-service for the **Predictive Tire Performance & Strategy Engine** — Apex Racing F1.

A physics-informed tire degradation model exposed over HTTP. Pure TypeScript on `node:http`, no external dependencies. Designed for hot-reload development with `bun --hot`.

## Run

```bash
cd /home/z/my-project/mini-services/ml-prediction-service
bun install
bun run dev          # bun --hot index.ts — auto-restart on change
```

Service listens on **http://localhost:3004**.

## Endpoints

### `POST /predict`
Predict tire performance degradation for the current lap.

**Body:** `{ tireTempFL, tireTempFR, tireTempRL, tireTempRR, tirePressureFL, tirePressureFR, tirePressureRL, tirePressureRR, slipAngleFL, slipAngleFR, brakeTempFL, brakeTempFR, fuelLoad, tireAge, compoundDeg, expectedLife, trackTemp, airTemp }`

**Response:**
```json
{
  "predictedPerf": 0.9142,
  "performanceClass": "warning_95",
  "confidenceLow": 0.8892,
  "confidenceHigh": 0.9392,
  "lapsToThreshold90": 14.6,
  "recommendation": "Monitor — approaching pit window",
  "inferenceMs": 1.23,
  "modelVersion": "v2.4.1",
  "timestamp": "2025-..."
}
```

### `POST /pit-window`
Compute the optimal pit window (lap where perf drops below 0.90) with ±2 lap margin, plus strategy recommendation.

**Body:** `{ tireAge, expectedLife, compoundDeg, currentLap, totalLaps, fuelLoad, trackTemp, ...telemetry }`

**Response:** `{ recommendedLap, windowLow, windowHigh, confidence, strategy, reasoning[], modelVersion, timestamp }`

### `GET /model/status`
Returns model metadata: version, accuracy/precision/recall/f1, features, thresholds, training info.

### `GET /model/feature-importance`
Returns SHAP-like feature importance sorted descending.

### `GET /model/training-history`
Returns the last 5 model versions with accuracy/F1/improvement.

### `GET /health`
`{ status: "ok", model: "v2.4.1", uptime }`

## Model

The predicted tire performance is computed from a physics-informed degradation model:

```
lapsFactor   = (tireAge / expectedLife) ^ 1.4
basePerf     = 1 - compoundDeg * lapsFactor
tempPenalty  = abs(avgTireTemp - 97) / 100 * 0.08
slipPenalty  = max(0, avgSlip - 3) * 0.012
fuelPenalty  = (fuelLoad / 110) * 0.03
trackTempPenalty = trackTemp > 45 ? 0.04 : 0
predictedPerf = clamp(basePerf - tempPenalty - slipPenalty - fuelPenalty - trackTempPenalty, 0.45, 1.0)
```

Performance classes:

| Class | Threshold |
|---|---|
| optimal | >= 0.95 |
| warning_95 | 0.90 – 0.95 |
| warning_90 | 0.85 – 0.90 |
| warning_85 | 0.80 – 0.85 |
| critical | < 0.80 |

Inference is benchmarked per request via `performance.now()` and reported in `inferenceMs`. Target latency budget: <200ms (typical observed: ~1–2ms).

## Constraints
- Pure TypeScript, no external deps (`node:http`).
- All inference <200ms (measured per request).
- CORS `*` enabled on all responses.

## License
MIT
