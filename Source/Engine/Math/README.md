# Module: Math

## Structure
- `Math.hpp` — `Vec2`, `Vec3`, `Mat4`, and free functions (`Radians`, `Degrees`,
  `Clamp`, `Lerp`, `Dot`, `Cross`). Header-only, `constexpr`-friendly.

## Description
A minimal, dependency-free linear-algebra layer. Column-major matrices and a
right-handed coordinate system (OpenGL convention). Used today by the Camera and,
in later missions, by physics and rendering.

## Responsibilities
- Provide vector/matrix types and common math helpers.
- Offer `LookAt` and `Perspective` matrix builders for cameras.
- Stay allocation-free and header-only for zero overhead on hot paths.

## Dependencies
- **Core/Types** (`inf::f32` etc.). Layer L0.
