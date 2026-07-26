# InfinityFootballEngine

The engine foundation: a C++20 static library of independent, layered
subsystems. Build target `InfinityFootballEngine` (alias `inf::engine`).

Include root is `Source/`, so headers are referenced as
`"Engine/<Module>/<File>.hpp"`.

## Modules & layers

| Layer | Module     | Namespace       | Summary                                        |
| ----- | ---------- | --------------- | ---------------------------------------------- |
| L0    | Platform   | `inf`           | OS/compiler detection, portable macros         |
| L0    | Math       | `inf::math`     | Vec2/Vec3/Mat4, math utils (header-only)       |
| L0    | Core       | `inf::core`,`inf`| Types, Assert, Result, Clock, Engine, Application |
| L1    | Logging    | `inf::log`      | Logger, levels, sinks (thread-safe)            |
| L1    | Config     | `inf::config`   | INI parser + ConfigManager                     |
| L1    | Events     | `inf::events`   | Type-indexed EventBus                          |
| L2    | Resources  | `inf::resources`| Ref-counted ResourceManager + loaders          |
| L2    | Save       | `inf::save`     | SaveData, Serializer, atomic SaveManager       |
| L2    | Camera     | `inf::camera`   | Camera math + smoothing controller             |
| L2    | Menu       | `inf::menu`     | Menu model + stack (UI-agnostic)               |
| L2    | Loading    | `inf::loading`  | Loading queue + flow state machine             |
| L3    | Audio      | `inf::audio`    | AudioSystem + IAudioBackend + Null backend     |
| L3    | Input      | `inf::input`    | InputSystem + IInputBackend + Null backend     |

Dependencies point downward only (plus `Logging`, the most foundational
service). See [`/Docs/Architecture.md`](../../Docs/Architecture.md) and each
module's own `README.md`.

## No gameplay

This library is the foundation only — no ball physics, player/coach AI, match
logic, or rendering. Those arrive in later missions (see
[`/Docs/Roadmap.md`](../../Docs/Roadmap.md)) behind the interfaces defined here.
