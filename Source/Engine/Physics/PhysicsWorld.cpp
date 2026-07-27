// =============================================================================
//  Infinity Football — Engine / Physics / PhysicsWorld (implementation)
//
//  Semi-implicit Euler integration with simple, deterministic collision
//  resolution. Bodies are stored by value in a vector; ids are 1-based indices,
//  so add every body up front (setup time) and only then keep references —
//  adding a body may reallocate the storage.
// =============================================================================
#include "Engine/Physics/PhysicsWorld.hpp"

namespace inf::physics
{
    namespace
    {
        // Below this downward speed a bounce is treated as resting (no rebound).
        constexpr f32 kRestSpeed = 0.25f;
        // Minimum impact speed for a ground contact to count as a bounce.
        constexpr f32 kBounceSpeed = 0.5f;

        f32 InvMass(const RigidBody& b) noexcept
        {
            return (b.dynamic && b.mass > 0.0f) ? 1.0f / b.mass : 0.0f;
        }
    } // namespace

    BodyId PhysicsWorld::AddBody(const RigidBody& body)
    {
        RigidBody copy = body;
        copy.id = static_cast<BodyId>(bodies_.size() + 1);
        bodies_.push_back(copy);
        return copy.id;
    }

    bool PhysicsWorld::IsValid(BodyId id) const noexcept
    {
        return id != 0 && id <= bodies_.size();
    }

    RigidBody& PhysicsWorld::Body(BodyId id) { return bodies_[id - 1]; }
    const RigidBody& PhysicsWorld::Body(BodyId id) const { return bodies_[id - 1]; }

    void PhysicsWorld::ClearColliders()
    {
        posts_.clear();
        planes_.clear();
    }

    const std::vector<CollisionEvent>& PhysicsWorld::Step(f64 dt)
    {
        collisions_.clear();
        const f32 h = static_cast<f32>(dt);
        Integrate(h);
        ResolveGround();
        ResolvePosts();
        ResolvePlanes();
        ResolveBodies();
        return collisions_;
    }

    void PhysicsWorld::Integrate(f32 dt)
    {
        for (auto& b : bodies_)
        {
            if (!b.dynamic) { continue; }
            const math::Vec3 accel = b.acceleration + gravity_;
            b.velocity = b.velocity + accel * dt;
            b.position = b.position + b.velocity * dt;
        }
    }

    void PhysicsWorld::ResolveGround()
    {
        const f32 surface = ground_.height;
        for (auto& b : bodies_)
        {
            if (!b.dynamic) { continue; }
            const f32 floorY = surface + b.radius;
            if (b.position.y > floorY)
            {
                b.onGround = false;
                continue;
            }

            b.position.y = floorY;
            const f32 downSpeed = -b.velocity.y; // positive when moving into ground
            if (downSpeed > 0.0f)
            {
                if (downSpeed > kRestSpeed)
                {
                    b.velocity.y = downSpeed * b.restitution;
                }
                else
                {
                    b.velocity.y = 0.0f;
                }
                // Tangential friction on contact.
                b.velocity.x *= (1.0f - b.friction);
                b.velocity.z *= (1.0f - b.friction);

                if (downSpeed > kBounceSpeed)
                {
                    ++b.bounceCount;
                    collisions_.push_back({CollisionKind::BodyGround, b.id, 0,
                                           {b.position.x, surface, b.position.z}, downSpeed});
                }
            }
            b.onGround = true;
        }
    }

    void PhysicsWorld::ResolveBodies()
    {
        const usize n = bodies_.size();
        for (usize i = 0; i < n; ++i)
        {
            for (usize j = i + 1; j < n; ++j)
            {
                RigidBody& a = bodies_[i];
                RigidBody& c = bodies_[j];
                const f32 invA = InvMass(a);
                const f32 invC = InvMass(c);
                const f32 invSum = invA + invC;
                if (invSum == 0.0f) { continue; } // both static

                const math::Vec3 delta = a.position - c.position;
                const f32 dist = delta.Length();
                const f32 minDist = a.radius + c.radius;
                if (dist <= 0.0f || dist >= minDist) { continue; }

                const math::Vec3 normal = delta * (1.0f / dist);
                const f32 penetration = minDist - dist;

                // Positional correction proportional to inverse mass.
                a.position = a.position + normal * (penetration * (invA / invSum));
                c.position = c.position - normal * (penetration * (invC / invSum));

                const f32 relVel = math::Dot(a.velocity - c.velocity, normal);
                if (relVel < 0.0f)
                {
                    const f32 e = a.restitution < c.restitution ? a.restitution : c.restitution;
                    const f32 jImp = -(1.0f + e) * relVel / invSum;
                    const math::Vec3 impulse = normal * jImp;
                    a.velocity = a.velocity + impulse * invA;
                    c.velocity = c.velocity - impulse * invC;
                }
                collisions_.push_back({CollisionKind::BodyBody, a.id, c.id,
                                       c.position + normal * c.radius,
                                       relVel < 0.0f ? -relVel : 0.0f});
            }
        }
    }

    void PhysicsWorld::ResolvePosts()
    {
        for (auto& b : bodies_)
        {
            if (!b.dynamic) { continue; }
            for (const auto& post : posts_)
            {
                // Closest point on the post's swept segment to the body centre.
                math::Vec3 closest = post.base;
                if (post.horizontal)
                {
                    closest.x = math::Clamp(b.position.x, post.base.x, post.base.x + post.height);
                }
                else
                {
                    closest.y = math::Clamp(b.position.y, post.base.y, post.base.y + post.height);
                }

                const math::Vec3 diff = b.position - closest;
                const f32 dist = diff.Length();
                const f32 minDist = post.radius + b.radius;
                if (dist <= 0.0f || dist >= minDist) { continue; }

                const math::Vec3 normal = diff * (1.0f / dist);
                b.position = b.position + normal * (minDist - dist);
                const f32 relVel = math::Dot(b.velocity, normal);
                if (relVel < 0.0f)
                {
                    b.velocity = b.velocity - normal * ((1.0f + b.restitution) * relVel);
                }
                collisions_.push_back({CollisionKind::BodyPost, b.id, 0, closest,
                                       relVel < 0.0f ? -relVel : 0.0f});
            }
        }
    }

    void PhysicsWorld::ResolvePlanes()
    {
        const math::Vec3 up{0.0f, 1.0f, 0.0f};
        for (auto& b : bodies_)
        {
            if (!b.dynamic) { continue; }
            for (const auto& plane : planes_)
            {
                const f32 signed_ = math::Dot(b.position - plane.point, plane.normal);
                if (signed_ >= b.radius) { continue; } // in front, no contact

                if (plane.halfWidth > 0.0f)
                {
                    const math::Vec3 tangent = math::Cross(plane.normal, up).Normalized();
                    const f32 lateral = math::Dot(b.position - plane.point, tangent);
                    if (lateral < -plane.halfWidth || lateral > plane.halfWidth) { continue; }
                }

                b.position = b.position + plane.normal * (b.radius - signed_);
                const f32 relVel = math::Dot(b.velocity, plane.normal);
                if (relVel < 0.0f)
                {
                    b.velocity = b.velocity - plane.normal * ((1.0f + plane.restitution) * relVel);
                }
                collisions_.push_back({CollisionKind::BodyPlane, b.id, 0, b.position,
                                       relVel < 0.0f ? -relVel : 0.0f});
            }
        }
    }
} // namespace inf::physics
