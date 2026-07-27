// =============================================================================
//  Infinity Football — Game / Football / Ball
//  The match ball. It is a thin, football-aware view over a sphere RigidBody
//  that lives in the shared PhysicsWorld — so the ball collides with players,
//  posts, nets and the ground through the same generic physics as everything
//  else. The ball is NEVER attached to a player: possession is a logical concept
//  handled elsewhere; the ball only ever moves under physics and impulses.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Engine/Physics/PhysicsWorld.hpp"

namespace inf::football
{
    /// Tunable ball properties (SI units). Defaults model a size-5 football.
    struct BallSpec
    {
        f32 diameter{0.22f};
        f32 mass{0.43f};
        f32 restitution{0.75f};
        f32 friction{0.30f};
    };

    class Ball
    {
    public:
        /// Registers a ball body in @p world at the given start position.
        Ball(physics::PhysicsWorld& world, const math::Vec3& start, const BallSpec& spec = {});

        [[nodiscard]] physics::BodyId BodyId() const noexcept { return bodyId_; }
        [[nodiscard]] f32 Diameter() const noexcept { return spec_.diameter; }
        [[nodiscard]] f32 Radius() const noexcept { return spec_.diameter * 0.5f; }

        [[nodiscard]] math::Vec3 Position() const;
        [[nodiscard]] math::Vec3 Velocity() const;
        [[nodiscard]] math::Vec3 Spin() const;
        [[nodiscard]] f32 Height() const;         ///< Height of the ball centre above ground.
        [[nodiscard]] f32 Speed() const;
        [[nodiscard]] u32 BounceCount() const;

        /// Applies an instantaneous kick (pass/shot/clearance). The ball leaves
        /// the foot as a free physical object — nothing stays attached.
        void Kick(const math::Vec3& impulse);
        /// Sets the ball's angular velocity (for future curve/Magnus effects).
        void SetSpin(const math::Vec3& spin);
        /// Places the ball at rest at @p where (kickoff, restarts).
        void ResetTo(const math::Vec3& where);

    private:
        [[nodiscard]] physics::RigidBody& Body();
        [[nodiscard]] const physics::RigidBody& Body() const;

        physics::PhysicsWorld* world_;
        physics::BodyId bodyId_;
        BallSpec spec_;
    };
} // namespace inf::football
