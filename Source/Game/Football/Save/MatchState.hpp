// =============================================================================
//  Infinity Football — Game / Football / Save / MatchState
//  Persists a match (teams, score, time, statistics) to a save slot by bridging
//  MatchEngine's SaveState/LoadState with the engine's SaveManager. Reuses the
//  foundation's atomic, versioned save I/O — no new file format is introduced.
// =============================================================================
#pragma once

#include "Engine/Core/Result.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Save/SaveManager.hpp"
#include "Game/Football/Match/MatchEngine.hpp"

namespace inf::football
{
    /// Writes the current match state to @p slot via @p manager. Atomic (no data
    /// loss) because it uses SaveManager's write-then-rename strategy.
    Status SaveMatchToSlot(const MatchEngine& match, save::SaveManager& manager,
                           const String& slot);

    /// Restores match score/time/statistics from @p slot into @p match.
    Status LoadMatchFromSlot(MatchEngine& match, save::SaveManager& manager, const String& slot);
} // namespace inf::football
