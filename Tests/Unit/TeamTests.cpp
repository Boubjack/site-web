// Unit tests — Team roster and formation application.
#include "Game/Football/Team/Team.hpp"
#include "Game/Football/Terrain/Pitch.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;

namespace
{
    Team BuildEleven(Side side)
    {
        Team team("Test XI", side, Formation::Create(FormationType::F_4_3_3));
        for (inf::u32 i = 0; i < 11; ++i)
        {
            const Role role = i == 0 ? Role::Goalkeeper : Role::Midfielder;
            team.AddStarter(Player(i + 1, "P" + std::to_string(i + 1),
                                   static_cast<inf::u8>(i + 1), role, FootStrong::Right, side));
        }
        return team;
    }
} // namespace

INF_TEST(Team_RosterCaptainCoach)
{
    Team team = BuildEleven(Side::Home);
    team.AddSubstitute(Player(20, "Sub", 20, Role::Forward, FootStrong::Left, Side::Home));
    team.SetCaptain(5);
    team.SetCoach("Coach X");

    REQUIRE_EQ(team.StarterCount(), static_cast<inf::usize>(11));
    REQUIRE_EQ(team.Bench().size(), static_cast<inf::usize>(1));
    REQUIRE_EQ(team.CaptainId(), static_cast<inf::u32>(5));
    REQUIRE_EQ(team.Coach(), inf::String("Coach X"));
    REQUIRE(team.FindById(5) != nullptr);
    REQUIRE(team.FindById(999) == nullptr);
}

INF_TEST(Team_ApplyFormationPlacesStarters)
{
    Pitch pitch;
    Team team = BuildEleven(Side::Home);
    team.ApplyFormation(pitch);

    // The keeper (slot 0) should be positioned near the Home goal line.
    REQUIRE(team.Starters()[0].Position().x < -pitch.HalfLength() * 0.8f);
    // Every starter has been given a position inside the field bounds.
    for (const auto& p : team.Starters())
    {
        REQUIRE(pitch.IsInsideField(p.Position()));
    }
}
