# Infinity Football

**Infinity Football** is an offline, realistic **PC football simulation** with
its own identity — built to play great on a mid-range PC, where gameplay feel
matters more than graphics.

> Canonical project documentation: [`INFINITY_FOOTBALL.md`](INFINITY_FOOTBALL.md)
> — the single source of truth for the project's vision and rules.

## Status

**Mission 1 — Foundation (v0.0.1).** The project structure, software
architecture and working engine subsystems are in place. **No gameplay yet**
(no ball physics, player/coach AI, match logic or rendering) — see
[`FoundationReport.md`](FoundationReport.md) and [`Docs/Roadmap.md`](Docs/Roadmap.md).

## Engine subsystems (this milestone)

Configuration · Logging · Events · Resources · Save · Audio · Input
(keyboard/gamepad) · Camera · Menu · Loading — plus Core, Math and Platform.
All written in C++20, dependency-light, unit-tested. Audio and Input ship with a
headless **Null** backend behind clean interfaces; real device backends slot in
later without changing callers.

## Build & run

Requirements: a C++20 compiler (GCC 11+/Clang 14+/MSVC 19.3+) and CMake ≥ 3.20.

```sh
# Configure (add -DINF_WERROR=ON for warnings-as-errors, as CI does)
cmake -S . -B Builds -G Ninja

# Build the engine, the Sandbox and the tests
cmake --build Builds

# Run the headless boot/smoke program
./Builds/Source/Sandbox/Sandbox

# Run the unit tests
ctest --test-dir Builds --output-on-failure
```

## Repository layout

See [`Docs/FolderStructure.md`](Docs/FolderStructure.md). Highlights:

- `Source/Engine` — the `InfinityFootballEngine` library (one folder per module,
  each with its own README).
- `Source/Sandbox` — headless executable that boots the engine.
- `Tests` — CTest unit tests + a tiny header-only framework.
- `Config` — default `.cfg` files loaded at startup.
- `Docs` — technical documentation (Vision, Architecture, Coding Standards,
  Roadmap, Glossary, Engine Overview).

## Documentation

| Document | Purpose |
| -------- | ------- |
| [Vision](Docs/Vision.md) | Project direction and pillars |
| [Architecture](Docs/Architecture.md) | Clean Architecture, SOLID, layering |
| [Folder Structure](Docs/FolderStructure.md) | Directory roles |
| [Coding Standards](Docs/CodingStandards.md) | C++ style + naming convention |
| [Roadmap](Docs/Roadmap.md) | v0.0.1 → v1.0 |
| [Glossary](Docs/Glossary.md) | Domain & technical terms |
| [Engine Overview](Docs/EngineOverview.md) | Per-subsystem API reference |

## License

Not yet specified.
