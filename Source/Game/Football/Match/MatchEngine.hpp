// =============================================================================
//  Infinity Football — Game / Football / Match / MatchEngine
//  The match orchestrator. It owns the physics world, pitch, ball, both teams,
//  the officials and the match camera, and advances a real match through its
//  phases: kickoff → first half → half-time → second half (each with added
//  time) → full time, maintaining clock, score, possession and statistics, and
//  applying the Laws of the Game (goals, out-of-play restarts).
//
//  This mission is STRUCTURAL: there is no player AI. Players are physical
//  colliders at their formation positions; external drivers (a demo harness, a
//  test, or — later — gameplay AI) put the ball in motion via ApplyKick(). The
//  engine handles everything that follows deterministically.
// =============================================================================
#pragma once

#include <unordered_map>

#include "Engine/Camera/Camera.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Events/EventBus.hpp"
#include "Engine/Math/Math.hpp"
#include "Engine/Physics/PhysicsWorld.hpp"
#include "Engine/Save/SaveData.hpp"
#include "Game/Football/Ball/Ball.hpp"
#include "Game/Football/Camera/MatchCameraDirector.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Match/MatchClock.hpp"
#include "Game/Football/Match/MatchStatistics.hpp"
#include "Game/Football/Match/Score.hpp"
#include "Game/Football/Officials/Officials.hpp"
#include "Game/Football/Rules/RuleBook.hpp"
#include "Game/Football/Team/Team.hpp"
#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    enum class MatchPhase : u8
    {
        PreMatch = 0,
        FirstHalf,
        HalfTime,
        SecondHalf,
        FullTime
    };

    const char* ToString(MatchPhase p) noexcept;

    /// Timing configuration (seconds). Defaults model a real 45'+ half.
    struct MatchConfig
    {
        f64 halfLengthSeconds{2700.0};
        f64 stoppageFirstSeconds{120.0};
        f64 stoppageSecondSeconds{180.0};
    };

    // --- Match events (emitted on the engine's EventBus) --------------------
    struct GoalScored { Side scorer; int minute; };
    struct RestartAwarded { RestartType type; Side forSide; };
    struct MatchEnded { u32 home; u32 away; };

    class MatchEngine
    {
    public:
        MatchEngine(Pitch pitch, Team home, Team away, MatchConfig config = {});

        /// Sets up colliders, formations, player bodies and the kickoff, then
        /// enters the first half. Call once before Update().
        void Start();

        /// Advances the match by @p dt seconds (fixed timestep recommended).
        void Update(f64 dt);

        /// External driver: kick the ball on behalf of @p by (records a shot).
        void ApplyKick(Side by, const math::Vec3& impulse);

        // --- Read access ----------------------------------------------------
        [[nodiscard]] MatchPhase Phase() const noexcept { return phase_; }
        [[nodiscard]] bool IsFinished() const noexcept { return phase_ == MatchPhase::FullTime; }
        [[nodiscard]] const Score& CurrentScore() const noexcept { return score_; }
        [[nodiscard]] const MatchStatistics& Statistics() const noexcept { return stats_; }
        [[nodiscard]] const MatchClock& Clock() const noexcept { return clock_; }
        [[nodiscard]] const Pitch& Field() const noexcept { return pitch_; }
        [[nodiscard]] Ball& MatchBall() noexcept { return ball_; }
        [[nodiscard]] const Ball& MatchBall() const noexcept { return ball_; }
        [[nodiscard]] Team& HomeTeam() noexcept { return home_; }
        [[nodiscard]] Team& AwayTeam() noexcept { return away_; }
        [[nodiscard]] MatchOfficials& Officials() noexcept { return officials_; }
        [[nodiscard]] MatchCameraDirector& CameraDirector() noexcept { return cameraDirector_; }
        [[nodiscard]] events::EventBus& Events() noexcept { return events_; }
        [[nodiscard]] Side LastTouch() const noexcept { return lastTouch_; }

        // --- Save / restore (match, teams, score, time, statistics) ---------
        void SaveState(save::SaveData& out) const;
        void LoadState(const save::SaveData& in);

    private:
        void RegisterPlayerBodies();
        void PlaceBallAtRest(const math::Vec3& where);
        void Simulate(f64 dt);
        void UpdateLastTouch(const std::vector<physics::CollisionEvent>& collisions);
        bool CheckGoal();
        void CheckOutOfPlay();
        void UpdatePossession(f64 dt);
        void BeginSecondHalf();
        [[nodiscard]] Side NearestSideToBall() const;

        physics::PhysicsWorld world_;
        Pitch pitch_;
        Team home_;
        Team away_;
        Ball ball_;
        MatchOfficials officials_;
        camera::Camera camera_;
        MatchCameraDirector cameraDirector_;
        events::EventBus events_;

        MatchClock clock_;
        Score score_;
        MatchStatistics stats_;
        MatchConfig config_;

        std::unordered_map<physics::BodyId, Side> bodyToSide_;
        MatchPhase phase_{MatchPhase::PreMatch};
        Side lastTouch_{Side::Home};
        Side kickoffSide_{Side::Home};
    };
} // namespace inf::football
