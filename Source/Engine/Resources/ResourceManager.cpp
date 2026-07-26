// =============================================================================
//  Infinity Football — Engine / Resources / ResourceManager (implementation)
// =============================================================================
#include "Engine/Resources/ResourceManager.hpp"

namespace inf::resources
{
    usize ResourceManager::PurgeUnused()
    {
        usize removed = 0;
        for (auto it = cache_.begin(); it != cache_.end();)
        {
            // use_count() == 1 means only the cache still holds this resource.
            if (it->second.use_count() == 1)
            {
                it = cache_.erase(it);
                ++removed;
            }
            else
            {
                ++it;
            }
        }
        return removed;
    }
} // namespace inf::resources
