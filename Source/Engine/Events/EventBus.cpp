// =============================================================================
//  Infinity Football — Engine / Events / EventBus (implementation)
// =============================================================================
#include "Engine/Events/EventBus.hpp"

namespace inf::events
{
    void EventBus::Unsubscribe(const Subscription& sub)
    {
        if (!sub.valid_) { return; }
        const auto it = handlers_.find(sub.type_);
        if (it == handlers_.end()) { return; }

        auto& list = it->second;
        for (auto e = list.begin(); e != list.end(); ++e)
        {
            if (e->id == sub.id_)
            {
                list.erase(e);
                return;
            }
        }
    }
} // namespace inf::events
