# Football Engine (Mission 2)

Technical overview of the football engine built on the Mission 1 foundation. It
comprises one new **engine** subsystem (generic physics) and one new **game**
library (`inf::football`). No gameplay AI, rendering, animation, menus or
commentary — this is the match engine that later missions build on.

## Layering

```
inf::football  (Source/Game/Football)   ← football rules, objects, match
        │  depends on
        ▼
inf::engine    (Source/Engine)          ← generic subsystems incl. Physics
```

The generic **Physics** world (`inf::physics::PhysicsWorld`) is engine-level and
knows nothing about football. The football layer *uses* it: the ball and players
are bodies in the world. This keeps physics fully separated from gameplay.

## Physics (`inf::physics`, engine)

- `RigidBody` — dynamic sphere (position/velocity/acceleration/spin, mass,
  radius, restitution, friction, bounce count, height).
- Colliders — `GroundPlane`, `VerticalPost` (goal posts), `Plane` (nets/bounds).
- `PhysicsWorld` — semi-implicit Euler integration at a fixed timestep, resolving
  body↔ground (bounce/friction), body↔body, body↔post and body↔plane collisions,
  reporting `CollisionEvent`s. Deterministic and allocation-light.

## Football (`inf::football`, game)

| Area | Types | Notes |
| ---- | ----- | ----- |
| Terrain | `Pitch`, `PitchDimensions` | Configurable metrics; geometry queries; builds colliders. |
| Ball | `Ball`, `BallSpec` | Physics-backed; never attached to a player. |
| Player | `Player`, `PlayerAttributes`, `PlayerState` | 18 attributes; 13 states (states only). |
| Team | `Team`, `Formation` | Roster/bench/captain/coach; 5 configurable formations. |
| Match | `MatchEngine`, `MatchClock`, `Score`, `MatchStatistics` | Phases, clock, score, possession, stats. |
| Rules | `RuleBook`, `Offside`, `Discipline` | Restarts, offside line, fouls/cards. |
| Officials | `Referee`, `AssistantReferee`, `FourthOfficial` | Identities + decision surface (no AI). |
| Camera | `MatchCameraDirector` | 5 modes; systems only, no rendering/replay. |
| Save | `MatchState` | Persist match via engine `SaveManager`. |

## Match lifecycle

`MatchEngine::Start()` builds colliders, applies formations, registers player
bodies (immovable colliders — no movement AI yet) and takes the kickoff.
`Update(dt)` advances the phase machine:

```
PreMatch → FirstHalf → HalfTime → SecondHalf → FullTime
             (+ added time on each half)
```

Each simulated tick steps physics, advances the clock, tracks the last touch from
collisions, detects goals, resolves out-of-play restarts (throw-in / corner /
goal kick), accumulates possession and statistics, and updates the camera.
External drivers (a test, or the MatchSim harness) put the ball in motion via
`ApplyKick`; the engine handles everything after.

## Coordinate frame

Origin at the centre spot. **X** goal-to-goal (Home goal at −X, Away at +X),
**Z** touchline-to-touchline, **Y** up. Metres and seconds throughout.

## Configuration

`Config/football.cfg` `[pitch]` section overrides any pitch dimension
(`PitchDimensions::LoadFromConfig`); omitted keys keep IFAB defaults.

## Verifying

```sh
cmake -S . -B Builds -G Ninja -DINF_WERROR=ON && cmake --build Builds
./Builds/Source/MatchSim/MatchSim        # runs a full match, prints score/stats
ctest --test-dir Builds --output-on-failure   # 20 suites incl. Ball/Player/Team/
                                              # MatchEngine/Physics/Rules/Terrain
```
