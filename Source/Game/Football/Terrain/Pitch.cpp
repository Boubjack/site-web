// =============================================================================
//  Infinity Football — Game / Football / Terrain / Pitch (implementation)
// =============================================================================
#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    void PitchDimensions::LoadFromConfig(const config::ConfigFile& file)
    {
        const char* s = "pitch";
        auto num = [&](const char* key, f32 fallback) {
            return file.Has(s, key) ? static_cast<f32>(file.Get(s, key).AsFloat(fallback))
                                    : fallback;
        };
        length = num("length", length);
        width = num("width", width);
        goalWidth = num("goal_width", goalWidth);
        goalHeight = num("goal_height", goalHeight);
        penaltyAreaLength = num("penalty_area_length", penaltyAreaLength);
        penaltyAreaWidth = num("penalty_area_width", penaltyAreaWidth);
        goalAreaLength = num("goal_area_length", goalAreaLength);
        goalAreaWidth = num("goal_area_width", goalAreaWidth);
        centreCircleRadius = num("centre_circle_radius", centreCircleRadius);
        penaltySpotDistance = num("penalty_spot_distance", penaltySpotDistance);
        penaltyArcRadius = num("penalty_arc_radius", penaltyArcRadius);
        cornerArcRadius = num("corner_arc_radius", cornerArcRadius);
        goalNetDepth = num("goal_net_depth", goalNetDepth);
        postRadius = num("post_radius", postRadius);
    }

    f32 Pitch::GoalLineX(Side side) const noexcept
    {
        return side == Side::Home ? -HalfLength() : HalfLength();
    }

    math::Vec3 Pitch::GoalCentre(Side side) const noexcept
    {
        return {GoalLineX(side), 0.0f, 0.0f};
    }

    math::Vec3 Pitch::PenaltySpot(Side side) const noexcept
    {
        const f32 sign = side == Side::Home ? 1.0f : -1.0f;
        return {GoalLineX(side) + sign * dims_.penaltySpotDistance, 0.0f, 0.0f};
    }

    math::Vec3 Pitch::CornerNear(Side goalSide) const noexcept
    {
        return {GoalLineX(goalSide), 0.0f, HalfWidth()};
    }

    math::Vec3 Pitch::CornerFar(Side goalSide) const noexcept
    {
        return {GoalLineX(goalSide), 0.0f, -HalfWidth()};
    }

    bool Pitch::IsInsideField(const math::Vec3& p) const noexcept
    {
        return p.x >= -HalfLength() && p.x <= HalfLength() && p.z >= -HalfWidth() &&
               p.z <= HalfWidth();
    }

    bool Pitch::IsInPenaltyArea(Side side, const math::Vec3& p) const noexcept
    {
        const f32 goalX = GoalLineX(side);
        const f32 halfBox = dims_.penaltyAreaWidth * 0.5f;
        if (p.z < -halfBox || p.z > halfBox) { return false; }
        if (side == Side::Home)
        {
            return p.x >= goalX && p.x <= goalX + dims_.penaltyAreaLength;
        }
        return p.x <= goalX && p.x >= goalX - dims_.penaltyAreaLength;
    }

    bool Pitch::IsInGoalArea(Side side, const math::Vec3& p) const noexcept
    {
        const f32 goalX = GoalLineX(side);
        const f32 halfBox = dims_.goalAreaWidth * 0.5f;
        if (p.z < -halfBox || p.z > halfBox) { return false; }
        if (side == Side::Home)
        {
            return p.x >= goalX && p.x <= goalX + dims_.goalAreaLength;
        }
        return p.x <= goalX && p.x >= goalX - dims_.goalAreaLength;
    }

    bool Pitch::IsGoal(Side side, const math::Vec3& p, f32 ballRadius) const noexcept
    {
        const f32 goalX = GoalLineX(side);
        const f32 halfGoal = dims_.goalWidth * 0.5f;
        // Ball fully past the line: centre beyond the line by at least its radius.
        const bool crossed =
            side == Side::Home ? (p.x + ballRadius < goalX) : (p.x - ballRadius > goalX);
        const bool betweenPosts = p.z >= -halfGoal && p.z <= halfGoal;
        const bool underBar = p.y <= dims_.goalHeight;
        return crossed && betweenPosts && underBar;
    }

    void Pitch::BuildColliders(physics::PhysicsWorld& world) const
    {
        world.SetGround(physics::GroundPlane{0.0f});

        const f32 halfGoal = dims_.goalWidth * 0.5f;
        for (Side side : {Side::Home, Side::Away})
        {
            const f32 goalX = GoalLineX(side);

            // Two vertical goal posts.
            for (f32 zsign : {-1.0f, 1.0f})
            {
                physics::VerticalPost post;
                post.base = {goalX, 0.0f, zsign * halfGoal};
                post.height = dims_.goalHeight;
                post.radius = dims_.postRadius;
                post.horizontal = false;
                world.AddPost(post);
            }

            // Crossbar (swept along X but positioned across Z at bar height).
            // Modelled as a horizontal post at the top, spanning the goal width
            // by placing its base at -halfGoal on Z and sweeping along X is not
            // correct; instead we approximate the bar with a thin plane check via
            // the two posts + net. The crossbar is represented by clamping goals
            // to underBar in IsGoal, keeping the collider set minimal and cheap.

            // Net: an absorbing plane a short distance behind the goal line,
            // limited to the goal width, facing the incoming ball.
            physics::Plane net;
            const f32 inward = side == Side::Home ? 1.0f : -1.0f; // toward field
            net.point = {goalX - inward * dims_.goalNetDepth, 0.0f, 0.0f};
            net.normal = {inward, 0.0f, 0.0f};
            net.restitution = 0.05f;
            net.halfWidth = halfGoal;
            world.AddPlane(net);
        }
    }
} // namespace inf::football
