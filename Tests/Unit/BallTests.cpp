// Unit tests — Ball (physics-backed, never attached to a player).
#include "Engine/Physics/PhysicsWorld.hpp"
#include "Game/Football/Ball/Ball.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;
using inf::f32;

INF_TEST(Ball_KickSetsVelocity)
{
    inf::physics::PhysicsWorld world;
    world.SetGround(inf::physics::GroundPlane{0.0f});
    Ball ball(world, {0.0f, 0.11f, 0.0f});

    REQUIRE_EQ(ball.Speed(), 0.0f);
    ball.Kick({0.43f * 10.0f, 0.0f, 0.0f}); // impulse = mass * 10 m/s
    REQUIRE(ball.Speed() > 9.0f && ball.Speed() < 11.0f);
}

INF_TEST(Ball_MovesUnderPhysics)
{
    inf::physics::PhysicsWorld world;
    world.SetGround(inf::physics::GroundPlane{0.0f});
    Ball ball(world, {0.0f, 0.11f, 0.0f});

    ball.Kick({0.43f * 5.0f, 0.0f, 0.0f});
    const f32 startX = ball.Position().x;
    for (int i = 0; i < 30; ++i) { world.Step(1.0 / 60.0); }
    REQUIRE(ball.Position().x > startX); // it travelled
}

INF_TEST(Ball_ResetStopsAndRepositions)
{
    inf::physics::PhysicsWorld world;
    world.SetGround(inf::physics::GroundPlane{0.0f});
    Ball ball(world, {0.0f, 0.11f, 0.0f});

    ball.Kick({10.0f, 5.0f, 0.0f});
    ball.ResetTo({3.0f, 0.11f, -2.0f});
    REQUIRE_EQ(ball.Position().x, 3.0f);
    REQUIRE_EQ(ball.Position().z, -2.0f);
    REQUIRE_EQ(ball.Speed(), 0.0f);
    REQUIRE_EQ(ball.BounceCount(), static_cast<inf::u32>(0));
}
