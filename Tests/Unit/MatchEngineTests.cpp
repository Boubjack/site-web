// Unit tests — MatchEngine lifecycle, goal detection and save/restore.
#include "Engine/Save/SaveData.hpp"
#include "Game/Football/Match/MatchEngine.hpp"
#include "Game/Football/Team/Formation.hpp"
#include "Game/Football/Team/Team.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;
using inf::f32;

namespace
{
    Team MakeTeam(Side side)
    {
        Team team(side == Side::Home ? "Home" : "Away", side,
                  Formation::Create(FormationType::F_4_3_3));
        for (inf::u32 i = 0; i < 11; ++i)
        {
            const Role role = i == 0 ? Role::Goalkeeper : Role::Midfielder;
            team.AddStarter(Player(side == Side::Home ? 100 + i : 200 + i, "P",
                                   static_cast<inf::u8>(i + 1), role, FootStrong::Right, side));
        }
        return team;
    }

    MatchEngine MakeMatch(MatchConfig cfg = {})
    {
        return MatchEngine(Pitch{}, MakeTeam(Side::Home), MakeTeam(Side::Away), cfg);
    }
} // namespace

INF_TEST(MatchEngine_RunsToFullTime)
{
    MatchConfig cfg;
    cfg.halfLengthSeconds = 0.2;
    cfg.stoppageFirstSeconds = 0.0;
    cfg.stoppageSecondSeconds = 0.0;

    MatchEngine match = MakeMatch(cfg);
    match.Start();
    REQUIRE(match.Phase() == MatchPhase::FirstHalf);

    for (int i = 0; i < 500 && !match.IsFinished(); ++i) { match.Update(1.0 / 60.0); }

    REQUIRE(match.IsFinished());
    REQUIRE(match.Phase() == MatchPhase::FullTime);
    REQUIRE(match.Clock().Total() > 0.0);
}

INF_TEST(MatchEngine_DetectsGoal)
{
    MatchEngine match = MakeMatch();
    match.Start();

    // Place the ball fully inside the Away goal (past +X line, central, low).
    const f32 hl = match.Field().HalfLength();
    match.MatchBall().ResetTo({hl + 0.5f, 0.4f, 0.0f});
    match.Update(1.0 / 60.0);

    REQUIRE_EQ(match.CurrentScore().home, static_cast<inf::u32>(1));
    REQUIRE_EQ(match.CurrentScore().away, static_cast<inf::u32>(0));
}

INF_TEST(MatchEngine_SaveStateWritesFields)
{
    MatchEngine match = MakeMatch();
    match.Start();
    const f32 hl = match.Field().HalfLength();
    match.MatchBall().ResetTo({hl + 0.5f, 0.4f, 0.0f});
    match.Update(1.0 / 60.0); // scores for Home

    inf::save::SaveData data;
    match.SaveState(data);
    REQUIRE_EQ(data.GetInt("match.score_home"), static_cast<inf::i64>(1));
    REQUIRE_EQ(data.GetString("match.home_team"), inf::String("Home"));
}

INF_TEST(MatchEngine_LoadStateRestoresScore)
{
    MatchEngine match = MakeMatch();
    match.Start();

    inf::save::SaveData data;
    data.SetInt("match.score_home", 3);
    data.SetInt("match.score_away", 2);
    data.SetFloat("match.time_total", 1234.0);
    match.LoadState(data);

    REQUIRE_EQ(match.CurrentScore().home, static_cast<inf::u32>(3));
    REQUIRE_EQ(match.CurrentScore().away, static_cast<inf::u32>(2));
}
