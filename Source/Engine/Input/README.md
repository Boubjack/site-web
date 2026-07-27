# Module: Input

## Structure
- `InputCodes.hpp/.cpp` — device-neutral `Key`, `GamepadButton`, `GamepadAxis`
  + text parsers for config bindings.
- `IInputBackend.hpp` — device-facing interface.
- `NullInputBackend.hpp` — headless backend with programmatic injection.
- `InputSystem.hpp/.cpp` — action mapping and edge detection.

## Description
Maps physical keys/buttons to named, rebindable **actions** (`Confirm`,
`MenuUp`, ...) loaded from configuration, so gameplay code never references raw
keys. Keyboard and gamepad work simultaneously. Edge detection distinguishes a
fresh press from a held control.

## Responsibilities
- Translate device state into high-level action state each frame.
- Load bindings from `[keyboard]`/`[gamepad]` config sections.
- Provide `IsActionActive` and `WasActionPressed` queries.

## Dependencies
- **Core/Types**, **Config** (bindings), **Logging**. Layer L3. Extend by
  injecting a real `IInputBackend` via `InputSystem::SetBackend`.
