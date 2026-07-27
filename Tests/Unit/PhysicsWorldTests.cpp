// Unit tests — Physics subsystem (integration + collisions).
#include "Engine/Physics/PhysicsWorld.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::physics;
using inf::f32;

INF_TEST(Physics_BodyFallsBouncesAndRests)
{
    PhysicsWorld world;
    world.SetGround(GroundPlane{0.0f});

    RigidBody ball;
    ball.position = {0.0f, 5.0f, 0.0f};
    ball.radius = 0.11f;
    ball.restitution = 0.6f;
    const BodyId id = world.AddBody(ball);

    for (int i = 0; i < 600; ++i) { world.Step(1.0 / 60.0); }

    const RigidBody& b = world.Body(id);
    REQUIRE(b.bounceCount >= 1);          // it bounced at least once
    REQUIRE(b.position.y < 0.2f);         // settled near the ground
    REQUIRE(b.position.y >= b.radius - 0.01f);
    REQUIRE(b.onGround);
}

INF_TEST(Physics_OverlappingBodiesSeparate)
{
    PhysicsWorld world;
    world.SetGround(GroundPlane{0.0f});

    RigidBody a;
    a.position = {0.0f, 0.11f, 0.0f};
    a.radius = 0.11f;
    RigidBody c;
    c.position = {0.15f, 0.11f, 0.0f}; // overlaps a (centres 0.15 < 0.22 apart)
    c.radius = 0.11f;

    const BodyId ia = world.AddBody(a);
    const BodyId ic = world.AddBody(c);

    world.Step(1.0 / 60.0);

    const f32 dx = world.Body(ic).position.x - world.Body(ia).position.x;
    REQUIRE(dx > 0.15f); // pushed further apart than they started
}

INF_TEST(Physics_StaticBodyDoesNotMove)
{
    PhysicsWorld world;
    world.SetGround(GroundPlane{0.0f});

    RigidBody wall;
    wall.position = {1.0f, 0.4f, 0.0f};
    wall.radius = 0.4f;
    wall.dynamic = false;
    const BodyId id = world.AddBody(wall);

    for (int i = 0; i < 60; ++i) { world.Step(1.0 / 60.0); }
    REQUIRE_EQ(world.Body(id).position.y, 0.4f); // gravity ignored for static
}
