# Engine Overview

Per-subsystem API reference and extension points. All subsystems live in
`Source/Engine`; each has its own `README.md` with structure and dependencies.

## Core (`inf::core`, `inf`)

- `Types.hpp` — fixed-width aliases (`u32`, `f32`, `usize`, `String`).
- `Assert.hpp` — `INF_ASSERT` (debug) / `INF_VERIFY` (always).
- `Result.hpp` — `Result<T>` and `Status` for fallible operations.
- `Clock.hpp` — monotonic per-frame delta timing.
- `Engine` — composition root: `Initialize(EngineConfig)`, `Update(dt)`,
  `Shutdown()`, plus accessors to every subsystem.
- `Application` — owns the main loop; `Run(EngineConfig)` returns an exit code.

## Platform (`inf`) & Math (`inf::math`)

- `Platform.hpp` — OS/compiler/build detection, `INF_FORCE_INLINE`, `INF_API`.
- `Math.hpp` — `Vec2`, `Vec3`, `Mat4` (LookAt/Perspective), `Radians`, `Clamp`,
  `Lerp`, `Dot`, `Cross`.

## Logging (`inf::log`)

`Logger` fans messages to `ILogSink`s above a level threshold; thread-safe.
`ConsoleSink`, `FileSink` provided. Macros: `INF_LOG_INFO(...) << streaming`.
**Extend:** implement `ILogSink` for new destinations.

## Config (`inf::config`)

`ConfigFile::Parse/Load` reads INI text; `ConfigValue` gives typed accessors
(`AsInt/AsFloat/AsBool/AsString`). `ConfigManager` holds named files and answers
`Get(name, section, key)`. Missing files are non-fatal.

## Events (`inf::events`)

`EventBus::Subscribe<T>(cb)` → `Subscription`; `Emit<T>(e)` delivers
synchronously; `Unsubscribe(sub)`. Any struct is an event type — no base class.

## Resources (`inf::resources`)

`ResourceManager::RegisterLoader<T>(factory)`, `Load<T>(id)` (cached, shared),
`PurgeUnused()` (releases entries with no external handle). **Extend:** register
a loader per resource type.

## Save (`inf::save`)

`SaveData` (versioned key/value), `Serializer` (text round-trip),
`SaveManager` (atomic write-then-rename slots, autosave provider hook). No data
loss on interrupted writes.

## Audio (`inf::audio`)

`AudioSystem` facade over `IAudioBackend`; `NullAudioBackend` default. Channels
(Crowd, Commentary, Effects, UI, Music) with clamped volumes. **Extend:** inject
a real `IAudioBackend` via `SetBackend` before `Initialize`.

## Input (`inf::input`)

`InputSystem` maps physical keys/buttons to named actions loaded from config;
supports keyboard + gamepad simultaneously; edge detection via
`WasActionPressed`. `NullInputBackend` default (with injection for tests).
**Extend:** inject a real `IInputBackend`.

## Camera (`inf::camera`)

`Camera` derives view/projection matrices from position/target/lens.
`CameraController` smoothly follows a desired pose (frame-rate independent).

## Menu (`inf::menu`)

`MenuModel` (items + cursor navigation, skips disabled, wraps), `MenuStack`
(push/pop navigation). UI-agnostic — no rendering.

## Loading (`inf::loading`)

`LoadingQueue` runs steps one at a time with monotonic `Progress()`.
`StateMachine` drives coarse flow (`Boot`, `MainMenu`, `Loading`, `InGame`,
`Paused`, `Shutdown`) with enter/exit callbacks.
