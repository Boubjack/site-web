// =============================================================================
//  Infinity Football — Game / Football / Officials
//  The match officials: the referee (who owns discipline), two assistant
//  referees (one per touchline) and the fourth official. There is deliberately
//  NO complex AI here — officials are identities plus a thin decision surface
//  that delegates to the rules/discipline systems.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Rules/Discipline.hpp"

namespace inf::football
{
    /// The referee applies discipline and signals decisions. Owns the match's
    /// DisciplineSystem so all cards flow through one authority.
    class Referee
    {
    public:
        explicit Referee(String name = "Referee") : name_(std::move(name)) {}

        [[nodiscard]] const String& Name() const noexcept { return name_; }

        [[nodiscard]] DisciplineSystem& Discipline() noexcept { return discipline_; }
        [[nodiscard]] const DisciplineSystem& Discipline() const noexcept { return discipline_; }

        /// Judges a foul through the discipline system.
        FoulResult JudgeFoul(u32 offenderId, FoulSeverity severity, bool inBox, bool advantage)
        {
            return discipline_.Judge(offenderId, severity, inBox, advantage);
        }

    private:
        String name_;
        DisciplineSystem discipline_;
    };

    /// An assistant referee patrolling one touchline; flags offside/throw-ins on
    /// their side. Identity only in this mission.
    struct AssistantReferee
    {
        String name{"Assistant"};
        Side touchline{Side::Home}; ///< Which half's touchline they run.
    };

    /// The fourth official (substitutions, added-time board). Identity only.
    struct FourthOfficial
    {
        String name{"Fourth Official"};
    };

    /// The full officiating crew for a match.
    struct MatchOfficials
    {
        Referee referee{"Referee"};
        AssistantReferee assistantOne{"Assistant 1", Side::Home};
        AssistantReferee assistantTwo{"Assistant 2", Side::Away};
        FourthOfficial fourth{"Fourth Official"};
    };
} // namespace inf::football
