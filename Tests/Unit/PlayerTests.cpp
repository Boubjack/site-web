// Unit tests — Player (identity, attributes, state).
#include "Game/Football/Player/Player.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;

INF_TEST(Player_IdentityAndAttributes)
{
    PlayerAttributes attr;
    attr.shooting = 88;
    attr.pace = 91;
    Player p(7, "Striker", 9, Role::Forward, FootStrong::Left, Side::Home, attr);

    REQUIRE_EQ(p.Id(), static_cast<inf::u32>(7));
    REQUIRE_EQ(p.Number(), static_cast<inf::u32>(9));
    REQUIRE_EQ(p.Name(), inf::String("Striker"));
    REQUIRE(p.PlayingRole() == Role::Forward);
    REQUIRE(p.StrongFoot() == FootStrong::Left);
    REQUIRE(p.TeamSide() == Side::Home);
    REQUIRE_EQ(p.Attributes().shooting, static_cast<inf::u8>(88));
    REQUIRE_EQ(p.Attributes().pace, static_cast<inf::u8>(91));
}

INF_TEST(Player_StateTransitions)
{
    Player p(1, "Keeper", 1, Role::Goalkeeper, FootStrong::Right, Side::Away);
    REQUIRE(p.State() == PlayerState::Idle); // default
    p.SetState(PlayerState::Sprint);
    REQUIRE(p.State() == PlayerState::Sprint);
    p.SetState(PlayerState::Header);
    REQUIRE(inf::String(ToString(p.State())) == "Header");
}

INF_TEST(Player_Positioning)
{
    Player p(2, "Back", 2, Role::Defender, FootStrong::Right, Side::Home);
    p.SetPosition({-30.0f, 0.0f, 10.0f});
    REQUIRE_EQ(p.Position().x, -30.0f);
    REQUIRE_EQ(p.Position().z, 10.0f);
}
