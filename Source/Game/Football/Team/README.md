# Module: Team

## Structure
- `Formation.hpp/.cpp` — `Formation`, `FormationType` (4-3-3, 4-4-2, 3-5-2,
  4-2-3-1, 5-3-2), `FormationSlot`.
- `Team.hpp/.cpp` — `Team` (starters, substitutes/bench, captain, coach,
  formation).

## Description
A club side and its shape. `Formation` stores 11 role-tagged slots in normalized
pitch coordinates (fully editable — configurable positions) and maps them to
world positions for a side. `Team` holds the starting eleven and the bench, the
captain and coach, and applies its formation to place the starters on the pitch.
Both are plain data (no physics), so they are testable in isolation; MatchEngine
attaches physics bodies to the starters at kickoff.

## Responsibilities
- Provide the five standard formations and editable slots.
- Map formation slots to world positions per side.
- Manage the roster (starters/bench), captain and coach.

## Dependencies
- Engine: **Math**, **Core/Types**. Football: **Common**, **Player**, **Terrain**.
