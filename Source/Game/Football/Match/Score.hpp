// =============================================================================
//  Infinity Football — Game / Football / Match / Score
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Game/Football/Common.hpp"

namespace inf::football
{
    struct Score
    {
        u32 home{0};
        u32 away{0};

        void Add(Side side) noexcept
        {
            if (side == Side::Home) { ++home; }
            else { ++away; }
        }

        [[nodiscard]] u32 For(Side side) const noexcept
        {
            return side == Side::Home ? home : away;
        }

        void Reset() noexcept
        {
            home = 0;
            away = 0;
        }
    };
} // namespace inf::football
