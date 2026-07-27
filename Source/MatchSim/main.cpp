// =============================================================================
//  Infinity Football — MatchSim
//  Headless harness that runs a COMPLETE football match through the MatchEngine
//  and prints the final score, possession and statistics.
//
//  There is NO gameplay AI in this mission, so the harness supplies a short,
//  deterministic script of ball impulses that each exercise one part of the
//  engine (a shot that scores, a ball out over a touchline, a ball over the
//  goal line), then lets the match clock run to full time. Everything after
//  each impulse — collisions, goal detection, restarts, clock, possession and
//  statistics — is handled by the engine itself.
// =============================================================================
#include <cstdio>

#include "Engine/Save/SaveManager.hpp"
#include "Game/Football/Match/MatchEngine.hpp"
#include "Game/Football/Save/MatchState.hpp"
#include "Game/Football/Team/Formation.hpp"
#include "Game/Football/Team/Team.hpp"

using namespace inf;
using namespace inf::football;

namespace
{
    constexpr f32 kBallMass = 0.43f; // kg — impulse = mass * desired velocity

    /// Builds an 11-player team whose roles follow the formation's slots.
    Team MakeTeam(const String& name, Side side, FormationType type, const String& coach)
    {
        Formation formation = Formation::Create(type);
        Team team(name, side, formation);
        for (u32 i = 0; i < Formation::kSlots; ++i)
        {
            const Role role = formation.Slot(i).role;
            PlayerAttributes attr;
            attr.pace = static_cast<u8>(60 + (i % 5) * 5);
            attr.passing = static_cast<u8>(55 + (i % 4) * 6);
            attr.shooting = role == Role::Forward ? 80 : 55;
            Player p(side == Side::Home ? 100 + i : 200 + i,
                     name + " #" + std::to_string(i + 1), static_cast<u8>(i + 1), role,
                     FootStrong::Right, side, attr);
            team.AddStarter(p);
        }
        team.SetCaptain(side == Side::Home ? 104 : 204);
        team.SetCoach(coach);
        return team;
    }
} // namespace

int main()
{
    Pitch pitch; // default IFAB dimensions
    Team home = MakeTeam("Infinity FC", Side::Home, FormationType::F_4_3_3, "A. Coach");
    Team away = MakeTeam("United AI", Side::Away, FormationType::F_4_4_2, "B. Manager");

    MatchConfig config; // real 45'+ halves
    MatchEngine match(std::move(pitch), std::move(home), std::move(away), config);

    // Print notable events as the engine emits them.
    match.Events().Subscribe<GoalScored>([](const GoalScored& g) {
        std::printf("  %2d'  GOAL — %s\n", g.minute, ToString(g.scorer));
    });
    match.Events().Subscribe<RestartAwarded>([&match](const RestartAwarded& r) {
        std::printf("  %2d'  %-10s to %s\n", match.Clock().Minute(), ToString(r.type),
                    ToString(r.forSide));
    });

    match.Start();
    std::printf("Kickoff: %s vs %s\n\n", match.HomeTeam().Name().c_str(),
                match.AwayTeam().Name().c_str());

    // Each play resets the ball to the centre spot, then kicks it, so the plays
    // are independent and deterministic regardless of earlier restarts.
    const math::Vec3 centre{0.0f, match.MatchBall().Radius(), 0.0f};
    auto play = [&](Side by, math::Vec3 velocity) {
        match.MatchBall().ResetTo(centre);
        match.ApplyKick(by, velocity * kBallMass);
    };

    constexpr f64 kDt = 1.0 / 60.0;
    u64 frame = 0;
    while (!match.IsFinished())
    {
        // Deterministic demonstration script (first half); each play exercises a
        // distinct engine path. The lofted trajectories fly over the (static)
        // players and goalkeeper.
        switch (frame)
        {
            case 60:  play(Side::Home, {32.0f, 8.5f, 2.0f}); break;  // → shot on target, goal
            case 300: play(Side::Home, {0.0f, 3.0f, 45.0f}); break;  // → out over touchline, throw-in
            case 600: play(Side::Home, {32.0f, 8.5f, 8.0f}); break;  // → over away goal line, goal kick
            default: break;
        }

        match.Update(kDt);
        ++frame;
    }

    // --- Final report ------------------------------------------------------
    const Score& s = match.CurrentScore();
    const MatchStatistics& st = match.Statistics();
    std::printf("\n================ FULL TIME ================\n");
    std::printf("%-14s %u - %u  %s\n", match.HomeTeam().Name().c_str(), s.home, s.away,
                match.AwayTeam().Name().c_str());
    std::printf("Possession   : %.0f%%   -   %.0f%%\n", st.PossessionPercent(Side::Home),
                st.PossessionPercent(Side::Away));
    std::printf("Shots        : %u    -    %u\n", st.Of(Side::Home).shots, st.Of(Side::Away).shots);
    std::printf("On target    : %u    -    %u\n", st.Of(Side::Home).shotsOnTarget,
                st.Of(Side::Away).shotsOnTarget);
    std::printf("Corners      : %u    -    %u\n", st.Of(Side::Home).corners,
                st.Of(Side::Away).corners);
    std::printf("Throw-ins    : %u    -    %u\n", st.Of(Side::Home).throwIns,
                st.Of(Side::Away).throwIns);
    std::printf("Goal kicks   : %u    -    %u\n", st.Of(Side::Home).goalKicks,
                st.Of(Side::Away).goalKicks);
    std::printf("Full match minutes: %d'\n", match.Clock().Minute());
    std::printf("Frames simulated  : %llu\n", static_cast<unsigned long long>(frame));

    // Persist the finished match (match, teams, score, time, statistics).
    save::SaveManager saves("Saves");
    if (SaveMatchToSlot(match, saves, "match_latest").IsOk())
    {
        std::printf("Saved match to Saves/match_latest.sav\n");
    }
    std::printf("===========================================\n");
    return 0;
}
