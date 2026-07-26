# Architecture

Infinity Football follows **Clean Architecture** and **SOLID** principles with a
strictly **acyclic, layered** module graph. The goal is a codebase that can grow
for years, stay testable, and never form circular dependencies.

## Principles

- **Single Responsibility** — each module owns one concern (logging, config,
  input, ...).
- **Open/Closed** — behaviour is extended through interfaces (`ILogSink`,
  `IAudioBackend`, `IInputBackend`, resource loaders) without editing existing
  code.
- **Dependency Inversion** — high-level code depends on interfaces; concrete
  device backends are injected. Audio and Input ship with a `Null` backend and
  accept a real one later without any caller changing.
- **No duplication, no dead code, no temporary functionality** — per the project
  quality rules.

## Layers (dependencies point downward only)

```
┌─────────────────────────────────────────────────────────────┐
│  App        Core::Engine (composition root), Core::Application │
├─────────────────────────────────────────────────────────────┤
│  L3 I/O     Audio, Input           (interface + Null backend)  │
├─────────────────────────────────────────────────────────────┤
│  L2 Services Resources, Save, Camera, Menu, Loading            │
├─────────────────────────────────────────────────────────────┤
│  L1 Base    Logging, Config, Events                            │
├─────────────────────────────────────────────────────────────┤
│  L0 Kernel  Platform, Math, Core (Types/Assert/Result/Clock)   │
└─────────────────────────────────────────────────────────────┘
```

A module may depend only on modules **below** it (and `Logging`, which is the
most foundational service). `Core::Engine` is the one place that knows every
subsystem; it wires them together but the subsystems never depend on each other
sideways.

## Composition root

`Core::Engine` owns every subsystem by value and exposes them through accessors.
It has three lifecycle phases:

1. **Initialize** — set up logging sinks, load configuration, initialize audio &
   input, load input bindings, enter the `MainMenu` flow state.
2. **Update(dt)** — poll input, advance the camera controller, update audio.
3. **Shutdown** — tear subsystems down in reverse order and flush logs.

`Core::Application` drives the loop (bounded/headless for the foundation; a
windowed loop reuses the same lifecycle later).

## Extension pattern

To add a real audio device backend:

1. Implement `audio::IAudioBackend` (e.g. `Sdl2AudioBackend`).
2. `engine.Audio().SetBackend(std::make_unique<Sdl2AudioBackend>())` before
   `Initialize()`.

No other file changes. The same pattern applies to input backends and resource
loaders.

## Error handling

Operations that can fail without being exceptional return `Result<T>` / `Status`
(a C++20 stand-in for `std::expected`). Assertions (`INF_ASSERT`, `INF_VERIFY`)
guard programmer errors. Logging never throws and degrades gracefully if a sink
is unavailable.

## Threading

The Logger is thread-safe (mutex-guarded sinks). Other subsystems are
single-threaded for the foundation; a job system is a future addition and will
sit at L1/L2 without breaking the layering.
