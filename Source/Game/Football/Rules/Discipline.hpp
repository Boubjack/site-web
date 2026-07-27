// =============================================================================
//  Infinity Football — Game / Football / Rules / Discipline
//  Fouls and cards. Given a foul's severity, location and whether advantage
//  favours the fouled team, it decides the outcome (play on with advantage, free
//  kick, or penalty) and any card. Two yellows for the same player become a red;
//  sent-off players are tracked. No AI — this is a rules table over inputs.
// =============================================================================
#pragma once

#include <map>
#include <set>

#include "Engine/Core/Types.hpp"

namespace inf::football
{
    enum class FoulSeverity : u8
    {
        Light = 0,   ///< A simple foul — usually no card.
        Reckless,    ///< Cautionable — yellow card.
        Violent      ///< Serious foul / violent conduct — red card.
    };

    enum class CardType : u8
    {
        None = 0,
        Yellow,
        Red
    };

    enum class FoulOutcome : u8
    {
        Advantage = 0, ///< Play continues; the fouled team keeps the ball.
        FreeKick,
        Penalty
    };

    const char* ToString(CardType c) noexcept;
    const char* ToString(FoulOutcome o) noexcept;

    struct FoulResult
    {
        FoulOutcome outcome{FoulOutcome::FreeKick};
        CardType card{CardType::None};
        bool secondYellow{false}; ///< True when the card is a red from two yellows.
    };

    class DisciplineSystem
    {
    public:
        /// Judges a foul by @p offenderId.
        /// @param inOpponentPenaltyArea true if the foul was inside the box → penalty.
        /// @param advantage true if the referee plays advantage (no stoppage).
        FoulResult Judge(u32 offenderId, FoulSeverity severity, bool inOpponentPenaltyArea,
                         bool advantage);

        [[nodiscard]] u8 YellowCount(u32 playerId) const;
        [[nodiscard]] bool IsSentOff(u32 playerId) const;

        void Reset();

    private:
        std::map<u32, u8> yellows_;
        std::set<u32> sentOff_;
    };
} // namespace inf::football
