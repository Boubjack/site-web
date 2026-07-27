# Module: Terrain

## Structure
- `Pitch.hpp/.cpp` — `PitchDimensions` (all metrics, config-loadable) and `Pitch`
  (geometry queries + collider builder).

## Description
Represents the field: length, width, penalty & goal areas, centre circle,
penalty spots, arcs, corners, goals. All dimensions are configurable (defaults
follow IFAB). The pitch answers geometric questions the rules need — is a point
in play, in a penalty/goal area, has the ball crossed a goal line for a goal —
and installs the field's static colliders (ground, goal posts, nets) into the
physics world. Coordinate frame: origin at centre, X goal-to-goal, Z
touchline-to-touchline, Y up.

## Responsibilities
- Hold configurable pitch dimensions and expose key spots/lines.
- Answer in-play / in-area / goal geometry queries.
- Build the field's static physics colliders.

## Dependencies
- Engine: **Config**, **Math**, **Physics**. Football: **Common**.
