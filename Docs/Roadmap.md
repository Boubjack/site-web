# Roadmap — v0.0.1 → v1.0

Versioning is **SemVer-flavoured**: `0.x` is pre-release; `1.0` is the first
complete offline game. Each milestone builds on the previous one and must ship
compiling, tested, and documented — never breaking earlier functionality.

| Version    | Theme                     | Key deliverables                                                                 |
| ---------- | ------------------------- | -------------------------------------------------------------------------------- |
| **0.0.1**  | **Foundation** *(done)*   | Project structure, architecture, engine subsystems (config/log/events/resources/save/audio/input/camera/menu/loading), CMake build, tests. **No gameplay.** |
| **0.1.0**  | **Football core engine** *(done)* | Generic PhysicsWorld; pitch, ball, players, teams, formations; MatchEngine (phases/clock/score/possession/stats); rules (restarts/offside/discipline); officials; camera modes; match save; MatchSim. **No AI/rendering.** |
| 0.0.2      | Windowing & rendering     | Window + real-time loop, a graphics backend behind an `IRenderer` interface, debug draw. |
| 0.0.3      | Real device backends      | SDL2/OpenAL audio + keyboard/gamepad input behind existing interfaces; asset pipeline v1. |
| 0.2.0      | Players (movement)        | Player locomotion driving the physics bodies, animation states, ball contact (no AI yet). |
| 0.3.0      | Player AI                 | Per-player vision, decision-making, positioning, marking, off-ball runs.         |
| 0.4.0      | Goalkeeper & coach AI     | Dedicated goalkeeper AI; coach/tactics AI shaping team behaviour.                 |
| 0.5.0      | Match rules & referee     | Referee: fouls, cards, offside, advantage, added time, penalties.                |
| 0.6.0      | Match flow                | Pre-match, kickoff, half-time, full-time, stats, man of the match.               |
| 0.7.0      | Broadcast                 | Cameras, replays, slow-motion, TV graphics, scoreboard, transitions.             |
| 0.8.0      | Competitions & data       | 10 leagues with teams, stadiums, kits, squads, fixtures, rules (data-driven).    |
| 0.9.0      | Career mode               | Manager/club creation, transfers, finances, staff, academy, training, contracts. |
| 0.9.5      | Audio & atmosphere        | Crowd, commentary, referee, ball/net SFX, chants, weather-driven ambience.       |
| 0.9.8      | UI & polish               | Full front-end, in-match HUD, options, accessibility; keyboard + gamepad.        |
| **1.0.0**  | **Complete offline game** | All modes integrated, optimized for a mid-range PC, save/load hardened, QA pass. |

## Guiding rules per milestone

1. Re-read [`INFINITY_FOOTBALL.md`](../INFINITY_FOOTBALL.md) before starting.
2. Extend behind existing interfaces; avoid breaking changes.
3. Keep the build warning-clean and all tests green.
4. Document new modules (README) and update this roadmap.
