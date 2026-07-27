# Coding Standards & Naming Convention

Target language: **C++20**. These rules keep the codebase readable, consistent
and easy to extend. They apply to all engine, tool and test code.

## Language & build

- **C++20**, no compiler extensions (`CMAKE_CXX_EXTENSIONS OFF`).
- Warnings enabled (`-Wall -Wextra -Wpedantic`); CI builds with `-Werror`
  (`-DINF_WERROR=ON`). Code must compile warning-clean.
- No exceptions across subsystem boundaries for expected failures — return
  `Result<T>` / `Status`. Exceptions are reserved for truly exceptional paths.
- Prefer standard library; add third-party dependencies only when justified and
  behind an interface.

## Naming convention

| Element                         | Convention          | Example                        |
| ------------------------------- | ------------------- | ------------------------------ |
| Namespaces                      | lower_snake         | `inf::audio`, `inf::config`    |
| Types (class/struct/enum/alias) | PascalCase          | `ResourceManager`, `LogLevel`  |
| Functions / methods             | PascalCase          | `LoadSound`, `IsActionActive`  |
| Public member accessors         | PascalCase          | `Position()`, `FrameCount()`   |
| Local variables / parameters    | camelCase           | `deltaSeconds`, `masterVolume` |
| Private data members            | camelCase + `_`     | `frameCount_`, `sinks_`        |
| Constants / constexpr           | `k` + PascalCase    | `kCurrentVersion`, `kPi`       |
| Enumerators                     | PascalCase          | `LogLevel::Warning`            |
| Macros                          | UPPER_SNAKE, `INF_` | `INF_LOG_INFO`, `INF_ASSERT`   |
| Interfaces (pure virtual)       | `I` + PascalCase    | `IAudioBackend`, `ILogSink`    |
| Files                           | PascalCase.hpp/.cpp | `EventBus.hpp`, `SaveData.cpp` |
| Folders / modules               | PascalCase          | `Source/Engine/Resources`      |

### Namespaces

- Root namespace is `inf`. Each subsystem uses a nested namespace
  (`inf::events`, `inf::save`, ...). Core lifecycle types live in `inf::core`.
- No `using namespace` in headers. In `.cpp`/tests a scoped `using` is fine.

## File layout

- Every file starts with the banner comment block naming the module and its role.
- Headers use `#pragma once`.
- Include order: matching header first (in `.cpp`), then C/C++ standard headers,
  then project headers — each group separated by a blank line, alphabetized.
- Include project headers by full path from `Source/`:
  `#include "Engine/Core/Types.hpp"`.

## Style

- Indent 4 spaces, no tabs. Braces on their own line for functions/types;
  K&R-style for control flow is acceptable when short.
- One class per header where practical; small helpers may share a file.
- Mark overrides `override`, single-arg constructors `explicit`, non-mutating
  methods `const`, and value-returning queries `[[nodiscard]]`.
- Prefer `enum class` over plain enums.
- Prefer `std::unique_ptr`/`std::shared_ptr` over raw owning pointers. Raw
  pointers/references express non-ownership only.
- `constexpr`/`noexcept` where they genuinely hold.

## Documentation

- Public types and methods carry a `///` doc comment describing intent,
  parameters, and pre/post-conditions where non-obvious.
- Comments explain **why**, not restate the code.

## Quality bar (from the project rules)

- No dead code, no forgotten `TODO`, no duplication, no temporary functionality.
- Every logic-bearing subsystem has unit tests under `Tests/Unit`.
- Do not break existing functionality; run the build and `ctest` before
  committing.

## Git

- Branch names: `claude/<topic>-<id>` or `feature/<topic>`, kebab-case.
- Commit messages: imperative mood, concise subject, body explaining the change.
