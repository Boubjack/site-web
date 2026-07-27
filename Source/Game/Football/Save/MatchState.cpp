// =============================================================================
//  Infinity Football — Game / Football / Save / MatchState (implementation)
// =============================================================================
#include "Game/Football/Save/MatchState.hpp"

namespace inf::football
{
    Status SaveMatchToSlot(const MatchEngine& match, save::SaveManager& manager,
                           const String& slot)
    {
        save::SaveData data;
        match.SaveState(data);
        return manager.Save(slot, data);
    }

    Status LoadMatchFromSlot(MatchEngine& match, save::SaveManager& manager, const String& slot)
    {
        auto result = manager.Load(slot);
        if (!result) { return Status::Err(result.Error()); }
        match.LoadState(result.Value());
        return Status::Ok();
    }
} // namespace inf::football
