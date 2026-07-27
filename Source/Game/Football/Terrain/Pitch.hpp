// =============================================================================
//  Infinity Football — Game / Football / Terrain / Pitch
//  The playing field: fully-configurable dimensions plus geometry queries used
//  by the rules (out of play, penalty area, spots, corners) and a builder that
//  installs the field's static colliders (ground, goal posts, crossbars, nets)
//  into a PhysicsWorld.
//
//  Coordinate frame: origin at the centre spot. X runs goal-to-goal in
//  [-length/2, +length/2]; Z runs touchline-to-touchline in [-width/2, +width/2];
//  Y is up. The Home goal is at -X, the Away goal at +X.
// =============================================================================
#pragma once

#include "Engine/Config/ConfigFile.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Engine/Physics/PhysicsWorld.hpp"
#include "Game/Football/Common.hpp"

namespace inf::football
{
    /// Every field dimension in metres. Defaults follow IFAB recommendations.
    struct PitchDimensions
    {
        f32 length{105.0f};             ///< Touchline length (goal to goal).
        f32 width{68.0f};               ///< Goal-line width.
        f32 goalWidth{7.32f};
        f32 goalHeight{2.44f};
        f32 penaltyAreaLength{16.5f};   ///< Depth from the goal line.
        f32 penaltyAreaWidth{40.32f};
        f32 goalAreaLength{5.5f};
        f32 goalAreaWidth{18.32f};
        f32 centreCircleRadius{9.15f};
        f32 penaltySpotDistance{11.0f};
        f32 penaltyArcRadius{9.15f};
        f32 cornerArcRadius{1.0f};
        f32 goalNetDepth{2.0f};         ///< How far the net sits behind the goal line.
        f32 postRadius{0.06f};

        /// Overrides fields present in the config's [pitch] section.
        void LoadFromConfig(const config::ConfigFile& file);
    };

    class Pitch
    {
    public:
        Pitch() = default;
        explicit Pitch(PitchDimensions dims) : dims_(dims) {}

        [[nodiscard]] const PitchDimensions& Dimensions() const noexcept { return dims_; }
        void SetDimensions(const PitchDimensions& d) noexcept { dims_ = d; }

        [[nodiscard]] f32 HalfLength() const noexcept { return dims_.length * 0.5f; }
        [[nodiscard]] f32 HalfWidth() const noexcept { return dims_.width * 0.5f; }
        [[nodiscard]] math::Vec3 Centre() const noexcept { return {0.0f, 0.0f, 0.0f}; }

        /// X of the goal line for a side (Home = -halfLength, Away = +halfLength).
        [[nodiscard]] f32 GoalLineX(Side side) const noexcept;
        [[nodiscard]] math::Vec3 GoalCentre(Side side) const noexcept;
        [[nodiscard]] math::Vec3 PenaltySpot(Side side) const noexcept;

        /// The two corner points on a side's goal line (±Z at that goal line).
        [[nodiscard]] math::Vec3 CornerNear(Side goalSide) const noexcept; ///< +Z corner
        [[nodiscard]] math::Vec3 CornerFar(Side goalSide) const noexcept;  ///< -Z corner

        /// True if @p p (X–Z) lies within the field of play (inclusive).
        [[nodiscard]] bool IsInsideField(const math::Vec3& p) const noexcept;
        /// True if @p p is within the penalty area of @p side's goal.
        [[nodiscard]] bool IsInPenaltyArea(Side side, const math::Vec3& p) const noexcept;
        /// True if @p p is within the goal area (six-yard box) of @p side's goal.
        [[nodiscard]] bool IsInGoalArea(Side side, const math::Vec3& p) const noexcept;

        /// True if the ball centre @p p has fully crossed @p side's goal line
        /// between the posts and below the crossbar (a goal against that side).
        [[nodiscard]] bool IsGoal(Side side, const math::Vec3& p, f32 ballRadius) const noexcept;

        /// Installs ground, goal posts, crossbars and nets into @p world.
        void BuildColliders(physics::PhysicsWorld& world) const;

    private:
        PitchDimensions dims_{};
    };
} // namespace inf::football
