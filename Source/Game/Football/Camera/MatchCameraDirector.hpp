// =============================================================================
//  Infinity Football — Game / Football / Camera / MatchCameraDirector
//  Positions the engine camera according to a match camera mode. This is the
//  camera SYSTEM only — no rendering and no replay recording yet; the Replay
//  mode simply frames the action like a broadcast angle. It drives the engine's
//  inf::camera::Camera from the ball position and pitch geometry.
// =============================================================================
#pragma once

#include "Engine/Camera/Camera.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::football
{
    class Pitch;

    enum class CameraMode : u8
    {
        Broadcast = 0, ///< Elevated sideline follow (default TV angle).
        Dynamic,       ///< Low, close chase of the ball.
        Tactical,      ///< High overhead view of the whole pitch.
        Goal,          ///< Behind whichever goal the ball is nearest.
        Replay         ///< Replay framing (system only — no recording yet).
    };

    const char* ToString(CameraMode m) noexcept;

    class MatchCameraDirector
    {
    public:
        explicit MatchCameraDirector(camera::Camera& camera) : camera_(camera) {}

        void SetMode(CameraMode mode) noexcept { mode_ = mode; }
        [[nodiscard]] CameraMode Mode() const noexcept { return mode_; }

        /// Recomputes the camera pose for the current mode from the ball.
        void Update(const math::Vec3& ballPosition, const Pitch& pitch);

    private:
        camera::Camera& camera_;
        CameraMode mode_{CameraMode::Broadcast};
    };
} // namespace inf::football
