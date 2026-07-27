# InfinityFootballGame

The football gameplay engine (Mission 2). Build target `InfinityFootballGame`
(alias `inf::football`), a static library that depends on the generic engine
(`inf::engine`) and contains **all football-specific logic**. Include root is
`Source/`, so headers are referenced as `"Game/Football/<Module>/<File>.hpp"`.

**No gameplay AI, no rendering, no animation, no menus, no commentary** — this
mission delivers the football *engine* (rules, physics-backed objects, match
orchestration) that later missions build on.

## Modules (`inf::football`)

| Module     | Summary                                                              |
| ---------- | ------------------------------------------------------------------- |
| Terrain    | `Pitch` + configurable `PitchDimensions`, geometry, colliders       |
| Ball       | `Ball` — a physics-backed sphere, never attached to a player        |
| Player     | `Player`, `PlayerAttributes`, `PlayerState` (states only)           |
| Team       | `Team` (roster/bench/captain/coach) + `Formation` (5 presets)       |
| Match      | `MatchEngine`, `MatchClock`, `Score`, `MatchStatistics`             |
| Rules      | `RuleBook` (restarts), `Offside`, `Discipline` (fouls/cards)        |
| Officials  | `Referee`, `AssistantReferee`, `FourthOfficial`                     |
| Camera     | `MatchCameraDirector` with 5 camera modes (systems only)            |
| Save       | `MatchState` — persist a match via the engine's SaveManager         |

## Physics separation

All physics lives in the engine's generic `inf::physics::PhysicsWorld`; the
football layer only *uses* it (the ball and players are bodies in the world).
Gameplay logic never implements physics, honouring the project rule that the
physics engine is fully separated from gameplay.

See [`/Docs/FootballEngine.md`](../../Docs/FootballEngine.md) and each module's
`README.md`.
