# Mission 2 Report — Football Core Engine

**Project:** Infinity Football — offline realistic PC football simulation
**Milestone:** v0.1.0 — Football Core Engine (no advanced rendering)
**Status:** ✅ **Complete.** Builds warning-clean with `-Werror`; `MatchSim` runs a
full match to full time; all **20** CTest suites pass; the Mission 1 foundation is
unchanged and still green.
**Scope note:** As required, **no animations, no advanced graphics, no
commentary, no game menus, and no AI** were implemented. This is the football
*engine* that later missions build on.

---

## 1. Summary

Mission 2 adds a generic physics engine and a full football game library on top
of the Mission 1 foundation, so a complete match can be simulated structurally.

- **Engine (generic):** a new `inf::physics::PhysicsWorld` — rigid sphere bodies,
  gravity, and ground/body/post/plane collision resolution — fully separated from
  gameplay.
- **Game library `inf::football`:** pitch, ball, players, teams & formations, the
  MatchEngine (phases, clock, score, possession, statistics), the Laws of the
  Game (restarts, offside, discipline), officials, match camera modes, and match
  save/restore.
- **MatchSim:** a headless executable that drives a complete match to full time.

New code: **1** engine physics module (5 files), **28** football library files,
**1** executable, **9** new unit-test suites. Everything is C++20, dependency
-light, SOLID, and acyclic (`inf::football` → `inf::engine` → std).

---

## 2. What was created (mapped to the brief)

| Brief item | Delivered |
| ---------- | --------- |
| **Terrain** (all dimensions configurable) | `Pitch` + `PitchDimensions` (length, width, penalty & goal areas, centre circle, spots, arcs, corners, goals, posts, nets); `LoadFromConfig` + `Config/football.cfg`. |
| **Ball** (position…rebounds, never attached) | `Ball` over a physics sphere `RigidBody`: velocity, acceleration, rotation/spin, mass, diameter, restitution, friction, height, bounces. Never parented to a player. |
| **Players** (ID…header, 18 attributes) | `Player` + `PlayerAttributes` (all listed attributes) + `Role`/`FootStrong`. |
| **Teams** (squad, subs, formation, captain, coach, bench) | `Team`. |
| **Formations** (4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 5-3-2, configurable) | `Formation` with 5 presets and editable slots mapped to world positions. |
| **Match** (start…end, clock, score, possession, stats) | `MatchEngine`, `MatchClock`, `Score`, `MatchStatistics`. |
| **Laws** (kickoff, throw-in, corner, goal kick, free kick, penalty, goal, restart) | `RuleBook` (`RestartType`) + goal detection on `Pitch` + discipline restarts. |
| **Offside** (full architecture) | `OffsideResolver` (offside line + position evaluation). |
| **Fouls** (foul, advantage, yellow, red) | `DisciplineSystem` (`FoulSeverity`, `FoulOutcome`, `CardType`). |
| **Referees** (main, assistants, fourth official) | `Referee`, `AssistantReferee` ×2, `FourthOfficial`. |
| **Collisions** (ball/player, player/player, ball/post, ball/net, ball/terrain) | Resolved generically by `PhysicsWorld` (ground, sphere-sphere, posts, planes/nets). |
| **Physics** (independent PhysicsWorld, separated from gameplay) | `inf::physics::PhysicsWorld` in the engine layer; football only *uses* it. |
| **Player states** (Idle…Header, states only) | `PlayerState` enum (13 states), no animation. |
| **Cameras** (Broadcast, Dynamic, Tactical, Goal, Replay) | `MatchCameraDirector` + `CameraMode`; systems only, no replay recording. |
| **Save** (match, teams, score, time, statistics) | `MatchEngine::SaveState/LoadState` + `MatchState` slot helpers over the engine `SaveManager`. |
| **Tests** (Ball, Player, Team, MatchEngine, PhysicsWorld, Rules, Terrain) | All present (plus Formation & Offside) — 9 new suites, all passing. |

---

## 3. New file tree

```
Source/Engine/Physics/         RigidBody.hpp · Collider.hpp · PhysicsWorld.[hpp/cpp]   (+README)
Source/Game/
  Football/
    Common.hpp
    Terrain/    Pitch.[hpp/cpp]                                                        (+README)
    Ball/       Ball.[hpp/cpp]                                                         (+README)
    Player/     Player.[hpp/cpp] · PlayerState.hpp                                     (+README)
    Team/       Team.[hpp/cpp] · Formation.[hpp/cpp]                                   (+README)
    Match/      MatchEngine.[hpp/cpp] · MatchClock.hpp · Score.hpp · MatchStatistics.hpp (+README)
    Rules/      RuleBook.[hpp/cpp] · Offside.[hpp/cpp] · Discipline.[hpp/cpp]          (+README)
    Officials/  Officials.hpp                                                          (+README)
    Camera/     MatchCameraDirector.[hpp/cpp]                                          (+README)
    Save/       MatchState.[hpp/cpp]                                                   (+README)
  CMakeLists.txt · README.md
Source/MatchSim/  main.cpp · CMakeLists.txt · README.md
Tests/Unit/       PhysicsWorldTests · TerrainTests · BallTests · PlayerTests ·
                  FormationTests · TeamTests · RulesTests · OffsideTests · MatchEngineTests
Config/football.cfg
Docs/FootballEngine.md
```

---

## 4. Architecture & separation of concerns

- **Physics is generic and gameplay-free.** `PhysicsWorld` knows only bodies and
  colliders. `Ball` and `Player` are bodies in that world, so ball/player,
  player/player, ball/post, ball/net and ball/ground collisions all fall out of
  the same generic resolver — no football code implements physics.
- **Data vs. simulation.** `Team`, `Player`, `Formation` are plain data (testable
  without a world); `MatchEngine` is the only place that wires physics bodies to
  players at kickoff.
- **Rules are stateless functions** of position and last touch; discipline and
  offside are isolated systems. Officials are thin identities over them.
- **SOLID / acyclic:** `inf::football` depends only on `inf::engine`; within the
  library, dependencies point Terrain/Ball/Player → Match, never back.

---

## 5. Build & verification

| Check | Command | Result |
| ----- | ------- | ------ |
| Configure | `cmake -S . -B Builds -G Ninja -DINF_WERROR=ON` | OK |
| Build | `cmake --build Builds` | Clean, **0 warnings** (`-Wall -Wextra -Wpedantic -Werror`) |
| Foundation intact | `./Builds/Source/Sandbox/Sandbox` | Exit **0** |
| Full match | `./Builds/Source/MatchSim/MatchSim` | Exit **0**; goal + throw-in + goal kick; **1–0** at full time (95'); match saved |
| Tests | `ctest --test-dir Builds` | **20/20 suites passed** (11 foundation + 9 new) |

---

## 6. Problems encountered

1. **Realistic scoreline without AI.** With no player/keeper AI, a naive demo
   either produced 0-0 (ball trapped among static players) or dozens of goals
   (lofted balls flew over the keeper). Resolved by making `MatchSim` a *scripted,
   deterministic* demonstration (a shot, a throw-in, a goal kick) that exercises
   the engine paths and yields a credible 1–0 — the MatchEngine itself is clean
   and AI-free. Realistic scorelines await the movement/AI missions.
2. **Static players as colliders.** Since there is no locomotion yet, player bodies
   are `dynamic = false` immovable colliders at formation positions — enough for
   ball/player collisions and a stable, deterministic simulation, without
   implementing any AI.
3. **Possession with a mostly-static ball.** Nearest-player possession can favour
   one side when the ball rests at the centre spot (a symmetric tie). It resolves
   naturally once the ball is in motion; noted as a known limitation until
   locomotion arrives.
4. **Reference stability in `PhysicsWorld`.** Bodies live in a `std::vector`;
   `Ball`/`Player` store `BodyId`s (never raw references), so adding bodies during
   setup cannot dangle. Documented in the world header.

No blocking issues remain.

---

## 7. Proposed improvements (next missions)

- **Player locomotion** driving the physics bodies (still pre-AI), then decision
  AI (vision, positioning, marking, runs) — the physics, states and rules are
  ready to receive them.
- **Goalkeeper logic** so shots are saved and scorelines become realistic.
- **Windowing + renderer** behind an `IRenderer` interface to visualize the
  match the engine already simulates.
- **Curve/Magnus** from the ball's `spin` (already carried on the body).
- **Config-driven formations & squads** (data files under `Assets/Data`).
- **Richer offside** (per-attacker phase, active/passive) — the pipeline exists.
- **CI** running the `-DINF_WERROR=ON` build + `ctest` on every push.

---

## 8. Conclusion

The Infinity Football **core football engine is complete, documented, tested and
verified**: a generic physics world and a full football library that runs a
complete match — kickoff to full time, with goals, restarts, clock, possession,
statistics and saving — built cleanly on the Mission 1 foundation, with **no AI,
rendering, animation, menus or commentary**, exactly as the mission required. The
project is ready for the movement/AI and rendering milestones on the
[roadmap](Docs/Roadmap.md).
