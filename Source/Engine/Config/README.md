# Module: Config

## Structure
- `ConfigValue.hpp/.cpp` — a text value with typed accessors
  (`AsInt/AsFloat/AsBool/AsString`).
- `ConfigFile.hpp/.cpp` — INI parser and in-memory model (`[section]`, `key=value`).
- `ConfigManager.hpp/.cpp` — owns named config files and answers queries.

## Description
Loads and queries INI-style configuration. Comments (`#`, `;`), sections and
whitespace trimming are supported. Missing files are non-fatal so the engine can
always boot on built-in defaults.

## Responsibilities
- Parse configuration text/files robustly (skip malformed lines).
- Provide typed access with fallbacks.
- Manage a named set of loaded files behind one query surface.

## Dependencies
- **Core/Types**, **Core/Result**, and **Logging** (warnings on load failure).
  Layer L1.
