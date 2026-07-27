# Module: Camera

## Structure
- `Camera.hpp` — position/target/lens → view & projection matrices (header-only).
- `CameraController.hpp/.cpp` — frame-rate-independent smoothing toward a pose.

## Description
A pure-math camera: it holds a position, look target and lens parameters and
derives view/projection matrices. No rendering — a future renderer simply
consumes these matrices. `CameraController` eases the camera toward a desired
pose for the broadcast "follow" feel.

## Responsibilities
- Produce correct right-handed view and perspective-projection matrices.
- Smoothly interpolate toward a desired position/target, independent of frame
  rate.

## Dependencies
- **Core/Types**, **Math**. Layer L2. No input or gameplay dependency — the
  caller feeds the desired target each frame.
