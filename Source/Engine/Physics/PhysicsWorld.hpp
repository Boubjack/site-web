// =============================================================================
//  Infinity Football — Engine / Physics / PhysicsWorld
//  A small, deterministic 3D physics world for dynamic sphere bodies over a
//  ground plane, with static posts and planes. It is completely independent of
//  gameplay: it knows bodies and colliders, never players or balls. Integration
//  is semi-implicit Euler at a fixed timestep supplied by the caller.
// =============================================================================
#pragma once

#include <vector>

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Engine/Physics/Collider.hpp"
#include "Engine/Physics/RigidBody.hpp"

namespace inf::physics
{
    /// What two things collided during a Step, reported after resolution.
    enum class CollisionKind : u8
    {
        BodyGround = 0,
        BodyBody,
        BodyPost,
        BodyPlane
    };

    struct CollisionEvent
    {
        CollisionKind kind{CollisionKind::BodyGround};
        BodyId a{0};                 ///< First (dynamic) body.
        BodyId b{0};                 ///< Second body for BodyBody, else 0.
        math::Vec3 point{};          ///< Approximate contact point.
        f32 impactSpeed{0.0f};       ///< Normal closing speed at contact.
    };

    class PhysicsWorld
    {
    public:
        /// Adds a dynamic (or static) body and returns its stable id (>= 1).
        BodyId AddBody(const RigidBody& body);

        /// Access a body by id. Precondition: id is valid.
        [[nodiscard]] RigidBody& Body(BodyId id);
        [[nodiscard]] const RigidBody& Body(BodyId id) const;
        [[nodiscard]] bool IsValid(BodyId id) const noexcept;
        [[nodiscard]] usize BodyCount() const noexcept { return bodies_.size(); }

        // --- Static colliders ---------------------------------------------------
        void SetGround(GroundPlane ground) { ground_ = ground; }
        void AddPost(const VerticalPost& post) { posts_.push_back(post); }
        void AddPlane(const Plane& plane) { planes_.push_back(plane); }
        void ClearColliders();

        void SetGravity(const math::Vec3& g) noexcept { gravity_ = g; }
        [[nodiscard]] const math::Vec3& Gravity() const noexcept { return gravity_; }

        /// Advances the simulation by @p dt seconds, resolving collisions.
        /// Returns the collisions detected this step (cleared each call).
        const std::vector<CollisionEvent>& Step(f64 dt);

        /// Collisions from the most recent Step.
        [[nodiscard]] const std::vector<CollisionEvent>& LastCollisions() const noexcept
        {
            return collisions_;
        }

    private:
        void Integrate(f32 dt);
        void ResolveGround();
        void ResolveBodies();
        void ResolvePosts();
        void ResolvePlanes();

        std::vector<RigidBody> bodies_;
        std::vector<VerticalPost> posts_;
        std::vector<Plane> planes_;
        std::vector<CollisionEvent> collisions_;

        GroundPlane ground_{};
        math::Vec3 gravity_{0.0f, -9.81f, 0.0f};
    };
} // namespace inf::physics
