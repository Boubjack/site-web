// =============================================================================
//  Infinity Football — Game / Football / Team (implementation)
// =============================================================================
#include "Game/Football/Team/Team.hpp"

#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    Player* Team::FindById(u32 id) noexcept
    {
        for (auto& p : starters_)
        {
            if (p.Id() == id) { return &p; }
        }
        for (auto& p : substitutes_)
        {
            if (p.Id() == id) { return &p; }
        }
        return nullptr;
    }

    void Team::ApplyFormation(const Pitch& pitch)
    {
        const auto positions = formation_.WorldPositions(pitch, side_);
        const usize count = starters_.size() < positions.size() ? starters_.size() : positions.size();
        for (usize i = 0; i < count; ++i)
        {
            starters_[i].SetPosition(positions[i]);
        }
    }
} // namespace inf::football
