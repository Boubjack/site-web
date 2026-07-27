// Unit tests — Formation presets and world mapping.
#include "Game/Football/Team/Formation.hpp"
#include "Game/Football/Terrain/Pitch.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::football;

INF_TEST(Formation_PresetsHaveElevenSlotsWithKeeper)
{
    for (FormationType t : {FormationType::F_4_3_3, FormationType::F_4_4_2,
                            FormationType::F_3_5_2, FormationType::F_4_2_3_1,
                            FormationType::F_5_3_2})
    {
        const Formation f = Formation::Create(t);
        REQUIRE_EQ(Formation::kSlots, static_cast<inf::usize>(11));
        REQUIRE(f.Slot(0).role == Role::Goalkeeper); // keeper is slot 0
    }
}

INF_TEST(Formation_WorldPositionsMirrorPerSide)
{
    Pitch pitch;
    const Formation f = Formation::Create(FormationType::F_4_3_3);
    const auto home = f.WorldPositions(pitch, Side::Home);
    const auto away = f.WorldPositions(pitch, Side::Away);

    // The goalkeeper sits near their own goal line: Home negative X, Away positive X.
    REQUIRE(home[0].x < -pitch.HalfLength() * 0.8f);
    REQUIRE(away[0].x > pitch.HalfLength() * 0.8f);
}

INF_TEST(Formation_SlotsAreConfigurable)
{
    Formation f = Formation::Create(FormationType::F_4_4_2);
    f.SetSlot(10, {Role::Forward, 0.9f, 0.0f});
    REQUIRE_EQ(f.Slot(10).nx, 0.9f);
    REQUIRE(f.Slot(10).role == Role::Forward);
}
