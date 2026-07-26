# Folder Structure

Top-level layout of the repository and the role of each directory.

```
site-web/
├── INFINITY_FOOTBALL.md     Canonical project documentation (source of truth)
├── FoundationReport.md      Mission 1 completion report
├── README.md                Project intro + build instructions
├── CMakeLists.txt           Root build script
│
├── Source/                  All engine & executable C++ source
│   ├── Engine/              InfinityFootballEngine static library (subsystems)
│   │   ├── Platform/        Compiler/OS detection, portable macros (L0)
│   │   ├── Math/            Vec2/Vec3/Mat4 and math utils (L0, header-only)
│   │   ├── Core/            Types, Assert, Result, Clock, Engine, Application
│   │   ├── Logging/         Logger, levels, sinks (L1)
│   │   ├── Config/          INI parser + ConfigManager (L1)
│   │   ├── Events/          Type-indexed EventBus (L1)
│   │   ├── Resources/       Ref-counted ResourceManager + loaders (L2)
│   │   ├── Save/            SaveData, Serializer, atomic SaveManager (L2)
│   │   ├── Camera/          Camera math + smoothing controller (L2)
│   │   ├── Menu/            Menu model + stack (L2)
│   │   ├── Loading/         Loading queue + flow state machine (L2)
│   │   ├── Audio/           IAudioBackend + AudioSystem + Null backend (L3)
│   │   └── Input/           IInputBackend + InputSystem + Null backend (L3)
│   └── Sandbox/             Headless boot executable (smoke test / example)
│
├── Tests/                   CTest unit tests + tiny header-only framework
│   ├── Framework/           TestFramework.hpp
│   └── Unit/                One .cpp per subsystem
│
├── Config/                  Default .cfg files loaded at startup
├── Assets/                  Runtime game content (empty in Mission 1)
├── Saves/                   Runtime save slots (git-ignored contents)
├── Logs/                    Runtime log output (git-ignored contents)
├── Builds/                  Out-of-source build output (git-ignored contents)
│
├── Docs/                    Technical documentation (this folder)
├── Specs/                   Detailed per-system design specs (as needed)
├── Missions/                Archived mission briefs
├── Scripts/                 Automation scripts (build/test/format/package)
└── Tools/                   Standalone developer tools
```

## Conventions

- **Include root is `Source/`**: every header is included as
  `"Engine/<Module>/<File>.hpp"`.
- **PascalCase** for folders and files; see [`CodingStandards.md`](CodingStandards.md).
- Output directories (`Builds`, `Logs`, `Saves`) keep a `README.md` and a
  `.gitignore` so the folder is tracked but its generated contents are not.
- Each `Source/Engine/<Module>` carries a `README.md` documenting its Structure,
  Description, Responsibilities and Dependencies.
