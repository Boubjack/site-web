// =============================================================================
//  Infinity Football — Game / Football / Rules / Offside
//  Offside infrastructure. The offside line is the X of the second-last
//  defender (goalkeeper included) on the defending side; an attacker is in an
//  offside position if they are nearer the opponent goal than both the ball and
//  that line, in the opponent half. The algorithm is intentionally simplified
//  (positional only), but the full pipeline — line computation + evaluation —
//  is in place for later refinement.
// =============================================================================
#pragma once

#include <vector>

#include "Engine/Core/Types.hpp"
#include "Game/Football/Common.hpp"

namespace inf::football
{
    class OffsideResolver
    {
    public:
        /// Attacking direction along X: +1 for Home (attacks +X), -1 for Away.
        [[nodiscard]] static f32 AttackDirection(Side attackingSide) noexcept
        {
            return attackingSide == Side::Home ? 1.0f : -1.0f;
        }

        /// The offside-line world X for @p attackingSide, given the defending
        /// team's player X positions. Returns the second-last defender's X. If
        /// there are fewer than two defenders, returns the last one's X (or 0).
        [[nodiscard]] static f32 OffsideLineX(Side attackingSide,
                                              const std::vector<f32>& defenderXs);

        /// True if an attacker at @p attackerX is in an offside position, given
        /// the ball's X and the offside line, for @p attackingSide.
        [[nodiscard]] static bool IsInOffsidePosition(Side attackingSide, f32 attackerX,
                                                      f32 ballX, f32 offsideLineX) noexcept;
    };
} // namespace inf::football
