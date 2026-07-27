// Unit tests — Laws of the Game (RuleBook restarts + Discipline).
#include "Game/Football/Rules/Discipline.hpp"
#include "Game/Football/Rules/RuleBook.hpp"
#include "Game/Football/Terrain/Pitch.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;
using inf::f32;

INF_TEST(Rules_ThrowInWhenOverTouchline)
{
    Pitch pitch;
    const f32 hw = pitch.HalfWidth();
    const auto d = RuleBook::EvaluateOutOfPlay(pitch, {0.0f, 0.11f, hw + 1.0f}, 0.11f, Side::Home);
    REQUIRE(d.type == RestartType::ThrowIn);
    REQUIRE(d.forSide == Side::Away); // opponent of who touched it last
    REQUIRE(d.position.z > 0.0f);
}

INF_TEST(Rules_CornerVersusGoalKick)
{
    Pitch pitch;
    const f32 hl = pitch.HalfLength();
    const inf::math::Vec3 pastHomeLine{-hl - 1.0f, 0.11f, 5.0f};

    // Defending (Home) put it behind its own line → corner to the attackers.
    const auto corner = RuleBook::EvaluateOutOfPlay(pitch, pastHomeLine, 0.11f, Side::Home);
    REQUIRE(corner.type == RestartType::CornerKick);
    REQUIRE(corner.forSide == Side::Away);

    // Attacking (Away) put it behind Home's line → goal kick to Home.
    const auto goalKick = RuleBook::EvaluateOutOfPlay(pitch, pastHomeLine, 0.11f, Side::Away);
    REQUIRE(goalKick.type == RestartType::GoalKick);
    REQUIRE(goalKick.forSide == Side::Home);
}

INF_TEST(Rules_BallInPlayHasNoRestart)
{
    Pitch pitch;
    const auto d = RuleBook::EvaluateOutOfPlay(pitch, {0.0f, 0.11f, 0.0f}, 0.11f, Side::Home);
    REQUIRE(d.type == RestartType::None);

    const auto ko = RuleBook::KickOffFor(pitch, Side::Home);
    REQUIRE(ko.type == RestartType::KickOff);
}

INF_TEST(Rules_DisciplineCardsAndOutcomes)
{
    DisciplineSystem d;

    // Reckless → yellow; a second yellow for the same player → red.
    REQUIRE(d.Judge(10, FoulSeverity::Reckless, false, false).card == CardType::Yellow);
    const FoulResult second = d.Judge(10, FoulSeverity::Reckless, false, false);
    REQUIRE(second.card == CardType::Red);
    REQUIRE(second.secondYellow);
    REQUIRE(d.IsSentOff(10));

    // Violent conduct → straight red.
    REQUIRE(d.Judge(11, FoulSeverity::Violent, false, false).card == CardType::Red);

    // Foul inside the box → penalty; advantage overrides the stoppage.
    REQUIRE(d.Judge(12, FoulSeverity::Light, true, false).outcome == FoulOutcome::Penalty);
    REQUIRE(d.Judge(13, FoulSeverity::Light, false, false).outcome == FoulOutcome::FreeKick);
    REQUIRE(d.Judge(14, FoulSeverity::Light, true, true).outcome == FoulOutcome::Advantage);
}
