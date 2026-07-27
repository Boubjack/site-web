// Unit tests — Offside infrastructure.
#include <vector>

#include "Game/Football/Rules/Offside.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;
using inf::f32;

INF_TEST(Offside_LineIsSecondLastDefender)
{
    // Home attacks +X. Defenders (Away) at these X positions; the second-last
    // (second nearest the attacked goal at +X) is at 40.
    const std::vector<f32> defenders{45.0f, 40.0f, 30.0f, 10.0f};
    const f32 line = OffsideResolver::OffsideLineX(Side::Home, defenders);
    REQUIRE_EQ(line, 40.0f);
}

INF_TEST(Offside_AttackerBeyondLineIsOffside)
{
    const f32 line = 40.0f;
    const f32 ballX = 20.0f;
    // Attacker ahead of both the line and the ball, in the opponent half.
    REQUIRE(OffsideResolver::IsInOffsidePosition(Side::Home, 42.0f, ballX, line));
    // Level with the line → onside.
    REQUIRE(!OffsideResolver::IsInOffsidePosition(Side::Home, 40.0f, ballX, line));
    // Behind the ball → onside even if beyond the line.
    REQUIRE(!OffsideResolver::IsInOffsidePosition(Side::Home, 42.0f, 45.0f, line));
}

INF_TEST(Offside_MirroredForAwaySide)
{
    // Away attacks -X; defenders (Home) near -X. Second-last is at -40.
    const std::vector<f32> defenders{-45.0f, -40.0f, -30.0f};
    const f32 line = OffsideResolver::OffsideLineX(Side::Away, defenders);
    REQUIRE_EQ(line, -40.0f);
    REQUIRE(OffsideResolver::IsInOffsidePosition(Side::Away, -42.0f, -20.0f, line));
}
