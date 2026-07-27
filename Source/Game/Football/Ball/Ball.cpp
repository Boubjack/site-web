// =============================================================================
//  Infinity Football — Game / Football / Ball (implementation)
// =============================================================================
#include "Game/Football/Ball/Ball.hpp"

namespace inf::football
{
    Ball::Ball(physics::PhysicsWorld& world, const math::Vec3& start, const BallSpec& spec)
        : world_(&world), bodyId_(0), spec_(spec)
    {
        physics::RigidBody body;
        body.position = start;
        body.radius = spec_.diameter * 0.5f;
        body.mass = spec_.mass;
        body.restitution = spec_.restitution;
        body.friction = spec_.friction;
        body.dynamic = true;
        bodyId_ = world_->AddBody(body);
    }

    physics::RigidBody& Ball::Body() { return world_->Body(bodyId_); }
    const physics::RigidBody& Ball::Body() const { return world_->Body(bodyId_); }

    math::Vec3 Ball::Position() const { return Body().position; }
    math::Vec3 Ball::Velocity() const { return Body().velocity; }
    math::Vec3 Ball::Spin() const { return Body().spin; }
    f32 Ball::Height() const { return Body().position.y; }
    u32 Ball::BounceCount() const { return Body().bounceCount; }

    f32 Ball::Speed() const { return Body().velocity.Length(); }

    void Ball::Kick(const math::Vec3& impulse) { Body().ApplyImpulse(impulse); }

    void Ball::SetSpin(const math::Vec3& spin) { Body().spin = spin; }

    void Ball::ResetTo(const math::Vec3& where) { Body().ResetTo(where); }
} // namespace inf::football
