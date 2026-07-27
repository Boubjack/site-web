// Unit tests — Terrain / Pitch geometry.
#include "Game/Football/Terrain/Pitch.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;
using inf::f32;

INF_TEST(Terrain_InsideAndOutside)
{
    Pitch pitch; // 105 x 68 by default
    REQUIRE(pitch.IsInsideField({0.0f, 0.0f, 0.0f}));
    REQUIRE(pitch.IsInsideField({52.0f, 0.0f, 33.0f}));
    REQUIRE(!pitch.IsInsideField({60.0f, 0.0f, 0.0f}));  // past goal line
    REQUIRE(!pitch.IsInsideField({0.0f, 0.0f, 40.0f}));  // past touchline
}

INF_TEST(Terrain_PenaltyAreaAndSpot)
{
    Pitch pitch;
    const f32 hl = pitch.HalfLength();
    // A point just in front of the Home goal is inside the Home penalty area.
    REQUIRE(pitch.IsInPenaltyArea(Side::Home, {-hl + 5.0f, 0.0f, 0.0f}));
    // Midfield is not.
    REQUIRE(!pitch.IsInPenaltyArea(Side::Home, {0.0f, 0.0f, 0.0f}));

    const auto spot = pitch.PenaltySpot(Side::Home);
    REQUIRE(spot.x > -hl);                       // in front of the goal line
    REQUIRE(spot.x < -hl + 12.0f);               // ~11 m out
}

INF_TEST(Terrain_GoalDetection)
{
    Pitch pitch;
    const f32 hl = pitch.HalfLength();
    const f32 r = 0.11f;
    // Ball fully past the Home goal line, central, under the bar → goal.
    REQUIRE(pitch.IsGoal(Side::Home, {-hl - 0.5f, 0.5f, 0.0f}, r));
    // Same X but wide of the posts → not a goal.
    REQUIRE(!pitch.IsGoal(Side::Home, {-hl - 0.5f, 0.5f, 10.0f}, r));
    // Over the bar → not a goal.
    REQUIRE(!pitch.IsGoal(Side::Home, {-hl - 0.5f, 5.0f, 0.0f}, r));
    // Ball still in play → not a goal.
    REQUIRE(!pitch.IsGoal(Side::Home, {0.0f, 0.5f, 0.0f}, r));
}

INF_TEST(Terrain_ConfigurableDimensions)
{
    const auto cfg = inf::config::ConfigFile::Parse("[pitch]\nlength = 100\nwidth = 64\n");
    PitchDimensions dims;
    dims.LoadFromConfig(cfg);
    REQUIRE_EQ(dims.length, 100.0f);
    REQUIRE_EQ(dims.width, 64.0f);
    Pitch pitch(dims);
    REQUIRE_EQ(pitch.HalfLength(), 50.0f);
}
