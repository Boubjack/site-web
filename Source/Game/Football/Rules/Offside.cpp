// =============================================================================
//  Infinity Football — Game / Football / Rules / Offside (implementation)
// =============================================================================
#include "Game/Football/Rules/Offside.hpp"

#include <algorithm>

namespace inf::football
{
    f32 OffsideResolver::OffsideLineX(Side attackingSide, const std::vector<f32>& defenderXs)
    {
        if (defenderXs.empty()) { return 0.0f; }

        const f32 dir = AttackDirection(attackingSide);
        // Rank defenders by how close they are to their own goal line, i.e. by
        // dir*x descending (largest = nearest the attacked goal). The second-last
        // defender is the one with the second-largest dir*x.
        std::vector<f32> proj;
        proj.reserve(defenderXs.size());
        for (f32 x : defenderXs) { proj.push_back(dir * x); }
        std::sort(proj.begin(), proj.end(), std::greater<f32>());

        const f32 secondLast = proj.size() >= 2 ? proj[1] : proj[0];
        return dir * secondLast; // back to world X
    }

    bool OffsideResolver::IsInOffsidePosition(Side attackingSide, f32 attackerX, f32 ballX,
                                              f32 offsideLineX) noexcept
    {
        const f32 dir = AttackDirection(attackingSide);
        // Offside if nearer the opponent goal than the line AND the ball, and in
        // the opponent half (dir*x > 0).
        return dir * attackerX > dir * offsideLineX && dir * attackerX > dir * ballX &&
               dir * attackerX > 0.0f;
    }
} // namespace inf::football
