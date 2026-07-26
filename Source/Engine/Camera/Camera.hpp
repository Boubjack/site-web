// =============================================================================
//  Infinity Football — Engine / Camera / Camera
//  Pure math camera: position, look target and lens parameters, from which it
//  derives view and projection matrices. No rendering — a renderer added later
//  simply consumes these matrices.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::camera
{
    class Camera
    {
    public:
        void SetPosition(const math::Vec3& p) noexcept { position_ = p; }
        void SetTarget(const math::Vec3& t) noexcept { target_ = t; }
        void SetUp(const math::Vec3& u) noexcept { up_ = u; }

        /// Vertical field of view in degrees, plus clip planes and aspect ratio.
        void SetLens(f32 fovYDegrees, f32 aspect, f32 nearZ, f32 farZ) noexcept
        {
            fovY_ = fovYDegrees;
            aspect_ = aspect;
            near_ = nearZ;
            far_ = farZ;
        }

        [[nodiscard]] const math::Vec3& Position() const noexcept { return position_; }
        [[nodiscard]] const math::Vec3& Target() const noexcept { return target_; }

        [[nodiscard]] math::Mat4 ViewMatrix() const noexcept
        {
            return math::Mat4::LookAt(position_, target_, up_);
        }
        [[nodiscard]] math::Mat4 ProjectionMatrix() const noexcept
        {
            return math::Mat4::Perspective(math::Radians(fovY_), aspect_, near_, far_);
        }

    private:
        math::Vec3 position_{0.0f, 0.0f, 0.0f};
        math::Vec3 target_{0.0f, 0.0f, -1.0f};
        math::Vec3 up_{0.0f, 1.0f, 0.0f};
        f32 fovY_{60.0f};
        f32 aspect_{16.0f / 9.0f};
        f32 near_{0.1f};
        f32 far_{1000.0f};
    };
} // namespace inf::camera
