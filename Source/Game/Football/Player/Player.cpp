// =============================================================================
//  Infinity Football — Game / Football / Player (implementation)
// =============================================================================
#include "Game/Football/Player/Player.hpp"

namespace inf::football
{
    const char* ToString(Role r) noexcept
    {
        switch (r)
        {
            case Role::Goalkeeper: return "Goalkeeper";
            case Role::Defender:   return "Defender";
            case Role::Midfielder: return "Midfielder";
            case Role::Forward:    return "Forward";
        }
        return "Unknown";
    }

    const char* ToString(FootStrong f) noexcept
    {
        switch (f)
        {
            case FootStrong::Left:  return "Left";
            case FootStrong::Right: return "Right";
            case FootStrong::Both:  return "Both";
        }
        return "Unknown";
    }
} // namespace inf::football
