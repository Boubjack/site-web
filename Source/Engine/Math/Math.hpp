// =============================================================================
//  Infinity Football — Engine / Math
//  Minimal, dependency-free linear-algebra layer used by Camera and (later)
//  physics/rendering. Header-only and constexpr-friendly for zero overhead.
//  Column-major matrices, right-handed coordinate system (OpenGL convention).
// =============================================================================
#pragma once

#include <cmath>

#include "Engine/Core/Types.hpp"

namespace inf::math
{
    inline constexpr f32 kPi = 3.14159265358979323846f;

    /// Convert degrees to radians.
    inline constexpr f32 Radians(f32 degrees) noexcept { return degrees * (kPi / 180.0f); }
    /// Convert radians to degrees.
    inline constexpr f32 Degrees(f32 radians) noexcept { return radians * (180.0f / kPi); }
    /// Clamp @p v to the inclusive range [lo, hi].
    inline constexpr f32 Clamp(f32 v, f32 lo, f32 hi) noexcept
    {
        return v < lo ? lo : (v > hi ? hi : v);
    }
    /// Linear interpolation between @p a and @p b by factor @p t.
    inline constexpr f32 Lerp(f32 a, f32 b, f32 t) noexcept { return a + (b - a) * t; }

    // --- Vec2 ---------------------------------------------------------------
    struct Vec2
    {
        f32 x{0.0f};
        f32 y{0.0f};

        constexpr Vec2() = default;
        constexpr Vec2(f32 x_, f32 y_) noexcept : x(x_), y(y_) {}

        constexpr Vec2 operator+(const Vec2& o) const noexcept { return {x + o.x, y + o.y}; }
        constexpr Vec2 operator-(const Vec2& o) const noexcept { return {x - o.x, y - o.y}; }
        constexpr Vec2 operator*(f32 s) const noexcept { return {x * s, y * s}; }

        f32 Length() const noexcept { return std::sqrt(x * x + y * y); }
    };

    // --- Vec3 ---------------------------------------------------------------
    struct Vec3
    {
        f32 x{0.0f};
        f32 y{0.0f};
        f32 z{0.0f};

        constexpr Vec3() = default;
        constexpr Vec3(f32 x_, f32 y_, f32 z_) noexcept : x(x_), y(y_), z(z_) {}

        constexpr Vec3 operator+(const Vec3& o) const noexcept { return {x + o.x, y + o.y, z + o.z}; }
        constexpr Vec3 operator-(const Vec3& o) const noexcept { return {x - o.x, y - o.y, z - o.z}; }
        constexpr Vec3 operator*(f32 s) const noexcept { return {x * s, y * s, z * s}; }

        f32 Length() const noexcept { return std::sqrt(x * x + y * y + z * z); }

        Vec3 Normalized() const noexcept
        {
            const f32 len = Length();
            return len > 0.0f ? Vec3{x / len, y / len, z / len} : Vec3{};
        }
    };

    inline constexpr f32 Dot(const Vec3& a, const Vec3& b) noexcept
    {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    inline constexpr Vec3 Cross(const Vec3& a, const Vec3& b) noexcept
    {
        return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x};
    }

    // --- Mat4 (column-major) ------------------------------------------------
    struct Mat4
    {
        // m[column][row]
        f32 m[4][4]{};

        /// Returns the 4x4 identity matrix.
        static constexpr Mat4 Identity() noexcept
        {
            Mat4 r{};
            r.m[0][0] = 1.0f;
            r.m[1][1] = 1.0f;
            r.m[2][2] = 1.0f;
            r.m[3][3] = 1.0f;
            return r;
        }

        /// Right-handed perspective projection.
        static Mat4 Perspective(f32 fovYRadians, f32 aspect, f32 zNear, f32 zFar) noexcept
        {
            const f32 f = 1.0f / std::tan(fovYRadians * 0.5f);
            Mat4 r{};
            r.m[0][0] = f / aspect;
            r.m[1][1] = f;
            r.m[2][2] = (zFar + zNear) / (zNear - zFar);
            r.m[2][3] = -1.0f;
            r.m[3][2] = (2.0f * zFar * zNear) / (zNear - zFar);
            return r;
        }

        /// Right-handed look-at view matrix.
        static Mat4 LookAt(const Vec3& eye, const Vec3& center, const Vec3& up) noexcept
        {
            const Vec3 f = (center - eye).Normalized();
            const Vec3 s = Cross(f, up).Normalized();
            const Vec3 u = Cross(s, f);
            Mat4 r = Identity();
            r.m[0][0] = s.x;  r.m[1][0] = s.y;  r.m[2][0] = s.z;
            r.m[0][1] = u.x;  r.m[1][1] = u.y;  r.m[2][1] = u.z;
            r.m[0][2] = -f.x; r.m[1][2] = -f.y; r.m[2][2] = -f.z;
            r.m[3][0] = -Dot(s, eye);
            r.m[3][1] = -Dot(u, eye);
            r.m[3][2] = Dot(f, eye);
            return r;
        }
    };
} // namespace inf::math
