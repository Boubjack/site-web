# Module: Platform

## Structure
- `Platform.hpp` — compile-time OS/compiler/build detection and portable macros.

## Description
The most foundational module. Provides `INF_PLATFORM_*`, `INF_COMPILER_*` and
`INF_BUILD_*` detection plus helper macros (`INF_FORCE_INLINE`, `INF_UNUSED`,
`INF_API`) so the rest of the engine is written portably.

## Responsibilities
- Detect the target OS, compiler and build configuration at compile time.
- Provide portable inlining/export/unused-argument macros.
- Keep a single, stable `INF_API` symbol so a future shared-library build needs
  no signature changes.

## Dependencies
- **None.** Layer L0. Header-only.
