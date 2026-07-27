// =============================================================================
//  Infinity Football — Game / Football / Match / MatchStatistics
//  Per-side match counters plus a ball-possession timer. Header-only state.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Game/Football/Common.hpp"

namespace inf::football
{
    /// Counting stats accumulated for one team during a match.
    struct TeamStats
    {
        u32 shots{0};
        u32 shotsOnTarget{0};
        u32 goals{0};
        u32 corners{0};
        u32 throwIns{0};
        u32 goalKicks{0};
        u32 freeKicks{0};
        u32 fouls{0};
        u32 offsides{0};
        u32 yellowCards{0};
        u32 redCards{0};
    };

    /// All match statistics: per-side counters and possession time in seconds.
    class MatchStatistics
    {
    public:
        [[nodiscard]] TeamStats& Of(Side side) noexcept
        {
            return side == Side::Home ? home_ : away_;
        }
        [[nodiscard]] const TeamStats& Of(Side side) const noexcept
        {
            return side == Side::Home ? home_ : away_;
        }

        /// Adds @p dt seconds of possession to @p side.
        void AddPossession(Side side, f64 dt) noexcept
        {
            if (side == Side::Home) { possessionHome_ += dt; }
            else { possessionAway_ += dt; }
        }

        /// Possession share of @p side as a percentage in [0, 100].
        [[nodiscard]] f32 PossessionPercent(Side side) const noexcept
        {
            const f64 total = possessionHome_ + possessionAway_;
            if (total <= 0.0) { return 50.0f; }
            const f64 share = side == Side::Home ? possessionHome_ : possessionAway_;
            return static_cast<f32>(share / total * 100.0);
        }

        void Reset() noexcept
        {
            home_ = {};
            away_ = {};
            possessionHome_ = 0.0;
            possessionAway_ = 0.0;
        }

    private:
        TeamStats home_{};
        TeamStats away_{};
        f64 possessionHome_{0.0};
        f64 possessionAway_{0.0};
    };
} // namespace inf::football
