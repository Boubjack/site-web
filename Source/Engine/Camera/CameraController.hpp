// =============================================================================
//  Infinity Football — Engine / Camera / CameraController
//  Smoothly drives a Camera toward a desired position/target, giving the framed
//  "broadcast" feel without snapping. Frame-rate independent via exponential
//  smoothing on the per-frame delta time. No input or gameplay dependency: the
//  caller decides what to follow and feeds the target each frame.
// =============================================================================
#pragma once

#include "Engine/Camera/Camera.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::camera
{
    class CameraController
    {
    public:
        explicit CameraController(Camera& camera) : camera_(camera) {}

        /// Sets the point the camera should look at (e.g. the ball).
        void SetDesiredTarget(const math::Vec3& t) noexcept { desiredTarget_ = t; }
        /// Sets where the camera should sit.
        void SetDesiredPosition(const math::Vec3& p) noexcept { desiredPosition_ = p; }
        /// Higher = snappier follow. Units: 1/seconds. Defaults to 5.
        void SetSmoothing(f32 responsePerSecond) noexcept { response_ = responsePerSecond; }

        /// Advances the smoothing by @p deltaSeconds and updates the camera.
        void Update(f64 deltaSeconds);

    private:
        Camera& camera_;
        math::Vec3 desiredTarget_{0.0f, 0.0f, -1.0f};
        math::Vec3 desiredPosition_{0.0f, 0.0f, 0.0f};
        f32 response_{5.0f};
    };
} // namespace inf::camera
