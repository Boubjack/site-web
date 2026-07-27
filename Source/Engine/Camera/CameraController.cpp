// =============================================================================
//  Infinity Football — Engine / Camera / CameraController (implementation)
// =============================================================================
#include "Engine/Camera/CameraController.hpp"

#include <cmath>

namespace inf::camera
{
    void CameraController::Update(f64 deltaSeconds)
    {
        // Frame-rate independent exponential smoothing:
        //   t = 1 - exp(-response * dt)
        // t -> 0 for tiny dt (no movement), t -> 1 for large dt (snap).
        const f32 t = 1.0f - std::exp(-response_ * static_cast<f32>(deltaSeconds));

        const math::Vec3 pos = camera_.Position();
        const math::Vec3 tgt = camera_.Target();

        camera_.SetPosition(math::Vec3{
            math::Lerp(pos.x, desiredPosition_.x, t),
            math::Lerp(pos.y, desiredPosition_.y, t),
            math::Lerp(pos.z, desiredPosition_.z, t),
        });
        camera_.SetTarget(math::Vec3{
            math::Lerp(tgt.x, desiredTarget_.x, t),
            math::Lerp(tgt.y, desiredTarget_.y, t),
            math::Lerp(tgt.z, desiredTarget_.z, t),
        });
    }
} // namespace inf::camera
