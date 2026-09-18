# Telemetry Service

Live F1 race telemetry WebSocket mini-service for the **Predictive Tire
Performance & Strategy Engine** (Apex Racing F1 team, Task 2-a).

## What it does

Simulates a live Monaco-style race (58 laps, loops indefinitely) and pushes
real-time telemetry for 5 drivers to every connected client over Socket.io:

| Code | Driver            | Team              | Car # |
|------|-------------------|-------------------|-------|
| VER  | Max Verstappen    | Red Bull Racing   | 1     |
| LEC  | Charles Leclerc   | Ferrari           | 16    |
| NOR  | Lando Norris      | McLaren           | 4     |
| TSU  | Yuki Tsunoda      | Apex Racing      | 22    |
| LAW  | Liam Lawson       | Apex Racing      | 30    |

Every **~2.5 seconds** the service advances the race by one lap and emits:

- `telemetry:update` — one event per driver, each carrying the full telemetry
  payload (tire temps/pressures, slip angles, brake temps, fuel load, tire
  performance score, lap time, speed trap, position, gap to leader, …).
- `pit:stop` — emitted when a driver reaches the end of a stint (lap 20 and
  lap 42 of the two-stop `S → M → M` strategy). Resets tire age and switches
  compound; adds a realistic ~22 s stationary time to the driver's race time.
- `race:status` — every 5 laps, with current lap, total laps, leader, fastest
  lap time and the driver who set it.
- `telemetry:snapshot` — sent once to each newly connected client so the
  dashboard can hydrate immediately.
- `race:restart` — emitted when the 58-lap race loops back to lap 1.

### Tire performance model

```
tirePerformance = 1 - compoundDeg * (tireAge / expectedLife)^1.4
                    - tempPenalty
                    - slipPenalty
```

| Compound | expectedLife | deg   |
|----------|--------------|-------|
| S (Soft) | 18 laps      | 0.045 |
| M (Med)  | 28 laps      | 0.028 |
| H (Hard) | 40 laps      | 0.017 |

- `tempPenalty` kicks in once the average tire temp drifts more than ±5 °C
  from the ~97 °C optimum.
- `slipPenalty` kicks in once slip angle exceeds ~3 °.

### Realistic baselines

- Tire temp ~92 °C base (+age heat), pressure ~22 psi (+age drift)
- Slip angle ~2.5 ° base, brake temp ~480 °C base
- Fuel starts at 105 kg and burns ~1.85 kg/lap
- Lap times are derived from a per-driver base Monaco pace plus fuel-weight
  and tire-degradation penalties + gaussian noise.

## Running

```bash
bun install
bun run dev          # bun --hot index.ts  (auto-restarts on file changes)
```

The service listens on **port 3003**.

- Socket.io endpoint: `path: "/"`, `cors: { origin: "*" }`
- Health check: `GET http://localhost:3003/health`

```json
{ "status": "ok", "connections": 3, "lap": 12, "totalLaps": 58 }
```

## Connecting through Caddy

Caddy (port 81) forwards to local services based on the
`?XTransformPort=<port>` query parameter, so a browser client can connect with:

```js
const socket = io('/?XTransformPort=3003', { path: '/' })
```

No absolute URLs or ports appear in any client-facing code.

## Files

- `package.json` — declares `socket.io` and the `bun --hot index.ts` dev script.
- `index.ts` — the full service: HTTP server, Socket.io server, race simulator,
  tire model, pit-stop logic, health endpoint, graceful shutdown.
- `README.md` — this file.
