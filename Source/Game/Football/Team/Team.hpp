// =============================================================================
//  Infinity Football — Game / Football / Team
//  A club side: starting eleven, substitutes (the bench), a formation, a
//  captain, and a coach. ApplyFormation places the starters at their formation
//  positions on a pitch. Team is plain data (no physics), so it is testable on
//  its own; MatchEngine attaches physics bodies to the starters at kickoff.
// =============================================================================
#pragma once

#include <vector>

#include "Engine/Core/Types.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Player/Player.hpp"
#include "Game/Football/Team/Formation.hpp"

namespace inf::football
{
    class Pitch;

    class Team
    {
    public:
        Team(String name, Side side, Formation formation)
            : name_(std::move(name)), side_(side), formation_(formation)
        {
        }

        // --- Roster ---------------------------------------------------------
        /// Adds a player to the starting eleven (up to 11).
        void AddStarter(const Player& p) { starters_.push_back(p); }
        /// Adds a player to the bench.
        void AddSubstitute(const Player& p) { substitutes_.push_back(p); }

        [[nodiscard]] std::vector<Player>& Starters() noexcept { return starters_; }
        [[nodiscard]] const std::vector<Player>& Starters() const noexcept { return starters_; }
        [[nodiscard]] std::vector<Player>& Substitutes() noexcept { return substitutes_; }
        [[nodiscard]] const std::vector<Player>& Substitutes() const noexcept { return substitutes_; }
        /// The bench is the set of substitutes.
        [[nodiscard]] const std::vector<Player>& Bench() const noexcept { return substitutes_; }

        [[nodiscard]] usize StarterCount() const noexcept { return starters_.size(); }

        // --- Meta -----------------------------------------------------------
        [[nodiscard]] const String& Name() const noexcept { return name_; }
        [[nodiscard]] Side TeamSide() const noexcept { return side_; }

        [[nodiscard]] const Formation& TeamFormation() const noexcept { return formation_; }
        void SetFormation(const Formation& f) noexcept { formation_ = f; }

        void SetCaptain(u32 playerId) noexcept { captainId_ = playerId; }
        [[nodiscard]] u32 CaptainId() const noexcept { return captainId_; }

        void SetCoach(String coach) noexcept { coach_ = std::move(coach); }
        [[nodiscard]] const String& Coach() const noexcept { return coach_; }

        /// Finds a starter or substitute by id, or nullptr.
        [[nodiscard]] Player* FindById(u32 id) noexcept;

        /// Places the starters at their formation positions on @p pitch.
        void ApplyFormation(const Pitch& pitch);

    private:
        String name_;
        Side side_;
        Formation formation_;
        std::vector<Player> starters_;
        std::vector<Player> substitutes_;
        u32 captainId_{0};
        String coach_{};
    };
} // namespace inf::football
