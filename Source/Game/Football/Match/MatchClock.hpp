// =============================================================================
//  Infinity Football — Game / Football / Match / MatchClock
//  Tracks played time. Each half runs for a configurable regulation length plus
//  added (stoppage) time. Header-only: pure state, no dependencies beyond types.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::football
{
    class MatchClock
    {
    public:
        /// Advances total and current-half timers by @p dt seconds.
        void Advance(f64 dt) noexcept
        {
            total_ += dt;
            half_ += dt;
        }

        /// Resets the current-half timer (call at kickoff of each half).
        void StartHalf() noexcept { half_ = 0.0; }
        void Reset() noexcept
        {
            total_ = 0.0;
            half_ = 0.0;
        }

        /// Restores timers (used when loading a saved match).
        void Restore(f64 total, f64 half = 0.0) noexcept
        {
            total_ = total;
            half_ = half;
        }

        [[nodiscard]] f64 Total() const noexcept { return total_; }
        [[nodiscard]] f64 HalfElapsed() const noexcept { return half_; }
        /// Displayed match minute (1-based ceiling not applied; simple floor).
        [[nodiscard]] int Minute() const noexcept { return static_cast<int>(total_ / 60.0); }

    private:
        f64 total_{0.0};
        f64 half_{0.0};
    };
} // namespace inf::football
