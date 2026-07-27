# Module: Match

## Structure
- `MatchClock.hpp` — regulation + added-time timers.
- `Score.hpp` — per-side goals.
- `MatchStatistics.hpp` — per-side counters + possession timer.
- `MatchEngine.hpp/.cpp` — the match orchestrator.

## Description
`MatchEngine` owns the physics world, pitch, ball, both teams, the officials and
the match camera, and advances a real match through its phases — kickoff → first
half → half-time → second half (each with added time) → full time — maintaining
the clock, score, possession and statistics and applying the Laws of the Game
(goal detection, out-of-play restarts). It is **structural**: there is no player
AI, so external drivers put the ball in motion via `ApplyKick`; everything that
follows (collisions, goals, restarts, timing, stats) is handled deterministically.
Match state (teams, score, time, statistics) can be saved and restored.

## Responsibilities
- Set up colliders, formations and player bodies; run the match lifecycle.
- Step physics, detect goals, resolve restarts, track possession/statistics.
- Emit match events and save/restore match state.

## Dependencies
- Engine: **Physics**, **Camera**, **Events**, **Save**, **Math**, **Logging**.
  Football: **Terrain**, **Ball**, **Team**, **Rules**, **Officials**, **Camera**.
