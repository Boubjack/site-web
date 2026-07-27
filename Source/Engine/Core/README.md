# Module: Core

## Structure
- `Types.hpp` — fixed-width type aliases (`u8..u64`, `i8..i64`, `f32/f64`,
  `usize`, `String`).
- `Assert.hpp` — `INF_ASSERT` (debug) and `INF_VERIFY` (always) macros.
- `Result.hpp` — `Result<T>` and `Status` (C++20 stand-in for `std::expected`).
- `Clock.hpp` — monotonic per-frame delta timing.
- `Engine.hpp/.cpp` — the composition root owning every subsystem.
- `Application.hpp/.cpp` — the main-loop driver around `Engine`.

## Description
Core holds the primitives every module relies on plus the engine's composition
root and loop. `Engine` constructs, wires and ticks all subsystems; `Application`
runs the loop (bounded/headless for the foundation).

## Responsibilities
- Define shared primitive types and error-handling types.
- Provide assertions and timing.
- Own the engine lifecycle: `Initialize → Update → Shutdown`.
- Be the single place that knows about all subsystems (keeps the graph acyclic).

## Dependencies
- **Platform**, **Math**, and — through `Engine` only — every subsystem
  (Logging, Config, Events, Resources, Save, Audio, Input, Camera, Menu,
  Loading). The primitive headers (Types/Assert/Result/Clock) depend on nothing
  but Platform. Layer L0 (primitives) / App (Engine, Application).
