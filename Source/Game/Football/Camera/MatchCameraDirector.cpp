// =============================================================================
//  Infinity Football — Game / Football / Camera / MatchCameraDirector (impl)
// =============================================================================
#include "Game/Football/Camera/MatchCameraDirector.hpp"

#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    const char* ToString(CameraMode m) noexcept
    {
        switch (m)
        {
            case CameraMode::Broadcast: return "Broadcast";
            case CameraMode::Dynamic:   return "Dynamic";
            case CameraMode::Tactical:  return "Tactical";
            case CameraMode::Goal:      return "Goal";
            case CameraMode::Replay:    return "Replay";
        }
        return "Unknown";
    }

    void MatchCameraDirector::Update(const math::Vec3& ball, const Pitch& pitch)
    {
        const f32 hw = pitch.HalfWidth();
        const f32 hl = pitch.HalfLength();

        switch (mode_)
        {
            case CameraMode::Broadcast:
                camera_.SetPosition({ball.x * 0.7f, 25.0f, -(hw + 18.0f)});
                camera_.SetTarget({ball.x * 0.85f, 0.0f, 0.0f});
                camera_.SetLens(38.0f, 16.0f / 9.0f, 0.5f, 400.0f);
                break;

            case CameraMode::Dynamic:
                camera_.SetPosition({ball.x, 8.0f, ball.z - 15.0f});
                camera_.SetTarget(ball);
                camera_.SetLens(50.0f, 16.0f / 9.0f, 0.3f, 300.0f);
                break;

            case CameraMode::Tactical:
                camera_.SetPosition({0.0f, hl * 1.1f, 0.0f});
                camera_.SetTarget({0.0f, 0.0f, 0.0f});
                camera_.SetLens(60.0f, 16.0f / 9.0f, 0.5f, 500.0f);
                break;

            case CameraMode::Goal:
            {
                const f32 sign = ball.x >= 0.0f ? 1.0f : -1.0f;
                camera_.SetPosition({sign * (hl + 12.0f), 10.0f, 0.0f});
                camera_.SetTarget({sign * (hl - 10.0f), 0.0f, ball.z});
                camera_.SetLens(45.0f, 16.0f / 9.0f, 0.3f, 300.0f);
                break;
            }

            case CameraMode::Replay:
                // Replay framing only — recording is a later mission.
                camera_.SetPosition({ball.x - 12.0f, 6.0f, ball.z - 10.0f});
                camera_.SetTarget(ball);
                camera_.SetLens(48.0f, 16.0f / 9.0f, 0.3f, 300.0f);
                break;
        }
    }
} // namespace inf::football
