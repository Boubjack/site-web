// =============================================================================
//  Infinity Football — Engine / Physics / RigidBody
//  A dynamic sphere body integrated by the PhysicsWorld. This is a generic
//  physics primitive: it has no notion of football. The Ball and Players wrap
//  a RigidBody in the game layer — the physics engine stays gameplay-agnostic.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::physics
{
    /// Identifier assigned by the PhysicsWorld when a body is added. 0 = invalid.
    using BodyId = u32;

    /// A dynamic body approximated as a sphere of a given radius. All motion is
    /// expressed in metres and seconds; the world's Y axis is up.
    struct RigidBody
    {
        BodyId id{0};

        math::Vec3 position{};
        math::Vec3 velocity{};
        math::Vec3 acceleration{}; ///< External per-step acceleration (e.g. wind); gravity is added by the world.
        math::Vec3 spin{};         ///< Angular velocity vector (rad/s); carried for future Magnus effects.

        f32 mass{1.0f};
        f32 radius{0.11f};       ///< Metres. Ball ≈ 0.11 m; players use a larger body radius.
        f32 restitution{0.6f};   ///< Bounciness in [0, 1]: fraction of normal speed kept per bounce.
        f32 friction{0.2f};      ///< Tangential damping in [0, 1] applied on ground contact.

        u32 bounceCount{0};      ///< Number of ground bounces since the last reset.
        bool onGround{false};    ///< True while resting/rolling on the ground plane.
        bool dynamic{true};      ///< A static body (dynamic=false) is not integrated but still collides.

        /// Convenience: the body's height above the ground plane (Y).
        [[nodiscard]] f32 Height() const noexcept { return position.y; }

        /// Applies an instantaneous impulse (kick/pass/shot). J = m * dv.
        void ApplyImpulse(const math::Vec3& impulse) noexcept
        {
            if (mass <= 0.0f) { return; }
            velocity = velocity + impulse * (1.0f / mass);
        }

        /// Resets kinematics to rest at @p where (keeps material properties).
        void ResetTo(const math::Vec3& where) noexcept
        {
            position = where;
            velocity = {};
            acceleration = {};
            spin = {};
            bounceCount = 0;
            onGround = false;
        }
    };
} // namespace inf::physics
