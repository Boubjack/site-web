# Module: Player

## Structure
- `PlayerState.hpp` — the 13 movement/action states (Idle…Header). **States only.**
- `Player.hpp/.cpp` — `Player`, `PlayerAttributes`, `Role`, `FootStrong`.

## Description
A footballer with stable identity (id, name, number, role, strong foot, side),
physical attributes and skill ratings (height, weight, pace, acceleration,
balance, stamina, power, accuracy, control, dribble, passing, shooting, heading),
a discrete `PlayerState`, and a field position. In a match the player is backed
by a `PhysicsWorld` body so the ball and other players collide with it; this
mission gives players no movement AI, so their bodies are immovable colliders at
their formation positions. `Player` itself is plain data and is fully testable
without a physics world.

## Responsibilities
- Hold player identity, attributes and current state.
- Carry the field position and the physics body link (set by MatchEngine).

## Dependencies
- Engine: **Math**, **Physics** (`RigidBody` id), **Core/Types**. Football: **Common**.
