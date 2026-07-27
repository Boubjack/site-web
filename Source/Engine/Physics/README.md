# Module: Physics

## Structure
- `RigidBody.hpp` — dynamic sphere body (position/velocity/accel/spin, mass,
  radius, restitution, friction, bounce count, height).
- `Collider.hpp` — static primitives: `GroundPlane`, `VerticalPost`, `Plane`.
- `PhysicsWorld.hpp/.cpp` — integrator + collision detection/resolution +
  `CollisionEvent` reporting.

## Description
A small, deterministic 3D physics world for sphere bodies over a ground plane,
with static goal posts and one-sided planes (nets/boundaries). It is **completely
independent of gameplay** — it knows bodies and colliders, never balls or players.
The game layer wraps `RigidBody` in `Ball` and `Player`. Integration is
semi-implicit Euler at a caller-supplied fixed timestep.

## Responsibilities
- Integrate dynamic bodies under gravity + external acceleration.
- Resolve body↔ground (bounce/friction/bounce-count), body↔body, body↔post and
  body↔plane collisions, reporting each as a `CollisionEvent`.
- Stay allocation-light and deterministic for a mid-range PC.

## Dependencies
- **Core/Types**, **Math**. Layer L2 (engine service). No gameplay dependency —
  physics is fully separated from football logic per the project rules.
