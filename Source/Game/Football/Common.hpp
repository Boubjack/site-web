// =============================================================================
//  Infinity Football — Game / Football / Common
//  Small shared enums used across the football modules.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::football
{
    /// Which end of the pitch a team defends. Home defends the negative-X goal,
    /// Away defends the positive-X goal. Teams attack the opposite goal.
    enum class Side : u8
    {
        Home = 0,
        Away
    };

    /// The opposing side.
    inline Side Opponent(Side s) noexcept { return s == Side::Home ? Side::Away : Side::Home; }

    inline const char* ToString(Side s) noexcept
    {
        return s == Side::Home ? "Home" : "Away";
    }
} // namespace inf::football
