# Module: Camera

## Structure
- `MatchCameraDirector.hpp/.cpp` — `CameraMode` (Broadcast, Dynamic, Tactical,
  Goal, Replay) and the director that drives the engine camera.

## Description
Positions the engine's `inf::camera::Camera` according to a match camera mode,
from the ball position and pitch geometry. This is the camera **system** only —
no rendering, and the `Replay` mode simply frames the action (recording is a
later mission). Modes range from a TV-style sideline follow to a high tactical
overhead and a behind-the-goal angle.

## Responsibilities
- Compute a camera pose per mode and apply it to the engine camera.

## Dependencies
- Engine: **Camera**, **Math**, **Core/Types**. Football: **Terrain**.
