# Config/

Default configuration files loaded by the engine at startup through the Config
subsystem (`Source/Engine/Config`). Format is INI-style:

```ini
# comment
[section]
key = value
```

| File          | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `engine.cfg`   | Application, video, audio and performance settings. |
| `input.cfg`    | Keyboard + gamepad action bindings.                 |
| `logging.cfg`  | Log level and sink toggles.                         |
| `football.cfg` | Pitch dimensions (`[pitch]`), loaded by `PitchDimensions::LoadFromConfig`. |

A missing file is non-fatal: the engine logs a warning and falls back to
built-in defaults, so the game always boots. Values are read on demand via
`ConfigManager::Get(file, section, key)` with typed accessors
(`AsInt`, `AsFloat`, `AsBool`, `AsString`).
