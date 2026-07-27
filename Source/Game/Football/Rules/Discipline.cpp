// =============================================================================
//  Infinity Football — Game / Football / Rules / Discipline (implementation)
// =============================================================================
#include "Game/Football/Rules/Discipline.hpp"

namespace inf::football
{
    const char* ToString(CardType c) noexcept
    {
        switch (c)
        {
            case CardType::None:   return "None";
            case CardType::Yellow: return "Yellow";
            case CardType::Red:    return "Red";
        }
        return "Unknown";
    }

    const char* ToString(FoulOutcome o) noexcept
    {
        switch (o)
        {
            case FoulOutcome::Advantage: return "Advantage";
            case FoulOutcome::FreeKick:  return "FreeKick";
            case FoulOutcome::Penalty:   return "Penalty";
        }
        return "Unknown";
    }

    FoulResult DisciplineSystem::Judge(u32 offenderId, FoulSeverity severity,
                                       bool inOpponentPenaltyArea, bool advantage)
    {
        FoulResult result;

        switch (severity)
        {
            case FoulSeverity::Light:    result.card = CardType::None; break;
            case FoulSeverity::Reckless: result.card = CardType::Yellow; break;
            case FoulSeverity::Violent:  result.card = CardType::Red; break;
        }

        if (result.card == CardType::Yellow)
        {
            const u8 count = static_cast<u8>(++yellows_[offenderId]);
            if (count >= 2)
            {
                result.card = CardType::Red;
                result.secondYellow = true;
            }
        }

        if (result.card == CardType::Red)
        {
            sentOff_.insert(offenderId);
        }

        // Advantage overrides the stoppage; otherwise a foul in the box is a
        // penalty, elsewhere a free kick.
        result.outcome = advantage ? FoulOutcome::Advantage
                                   : (inOpponentPenaltyArea ? FoulOutcome::Penalty
                                                            : FoulOutcome::FreeKick);
        return result;
    }

    u8 DisciplineSystem::YellowCount(u32 playerId) const
    {
        const auto it = yellows_.find(playerId);
        return it != yellows_.end() ? it->second : static_cast<u8>(0);
    }

    bool DisciplineSystem::IsSentOff(u32 playerId) const
    {
        return sentOff_.find(playerId) != sentOff_.end();
    }

    void DisciplineSystem::Reset()
    {
        yellows_.clear();
        sentOff_.clear();
    }
} // namespace inf::football
