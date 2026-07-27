// Unit tests — Math layer.
#include "Engine/Math/Math.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::math;

INF_TEST(Math_VectorArithmetic)
{
    const Vec3 a{1.0f, 2.0f, 3.0f};
    const Vec3 b{4.0f, 5.0f, 6.0f};
    const Vec3 sum = a + b;
    REQUIRE_EQ(sum.x, 5.0f);
    REQUIRE_EQ(sum.y, 7.0f);
    REQUIRE_EQ(sum.z, 9.0f);
    REQUIRE_EQ(Dot(a, b), 32.0f);
}

INF_TEST(Math_Normalize)
{
    const Vec3 n = Vec3{0.0f, 3.0f, 4.0f}.Normalized();
    REQUIRE(n.Length() > 0.999f && n.Length() < 1.001f);
}

INF_TEST(Math_Identity)
{
    const Mat4 id = Mat4::Identity();
    REQUIRE_EQ(id.m[0][0], 1.0f);
    REQUIRE_EQ(id.m[1][1], 1.0f);
    REQUIRE_EQ(id.m[2][2], 1.0f);
    REQUIRE_EQ(id.m[3][3], 1.0f);
    REQUIRE_EQ(id.m[0][1], 0.0f);
}

INF_TEST(Math_ClampAndLerp)
{
    REQUIRE_EQ(Clamp(5.0f, 0.0f, 1.0f), 1.0f);
    REQUIRE_EQ(Clamp(-5.0f, 0.0f, 1.0f), 0.0f);
    REQUIRE_EQ(Lerp(0.0f, 10.0f, 0.5f), 5.0f);
}
