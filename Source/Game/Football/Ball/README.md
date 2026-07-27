# Module: Ball

## Structure
- `Ball.hpp/.cpp` — `Ball` (a football-aware view over a physics body) and
  `BallSpec` (diameter, mass, restitution, friction).

## Description
The match ball. It is a thin wrapper over a sphere `RigidBody` living in the
shared `PhysicsWorld`, so it collides with players, posts, nets and the ground
through the same generic physics as everything else. It exposes football
properties — position, velocity, spin, height, bounce count — and `Kick`,
`SetSpin`, `ResetTo`. The ball is **never attached to a player**: it only ever
moves under physics and applied impulses.

## Responsibilities
- Own the ball's physics body and material properties.
- Provide football-level accessors and impulses (kick/pass/shot).
- Reset to rest for kickoff and restarts.

## Dependencies
- Engine: **Physics**, **Math**, **Core/Types**.
