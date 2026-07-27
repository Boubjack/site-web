// =============================================================================
//  Infinity Football — Engine / Core / Clock
//  High-resolution timing used to drive the fixed/variable-step main loop.
// =============================================================================
#pragma once

#include <chrono>

#include "Engine/Core/Types.hpp"

namespace inf
{
    /// Monotonic clock producing per-frame delta times in seconds.
    class Clock
    {
    public:
        Clock() : start_(Now()), last_(start_) {}

        /// Advances the clock one frame and returns the elapsed time, in
        /// seconds, since the previous call to Tick() (or construction).
        f64 Tick() noexcept
        {
            const auto now = Now();
            const f64 dt = std::chrono::duration<f64>(now - last_).count();
            last_ = now;
            return dt;
        }

        /// Total seconds elapsed since the clock was created.
        [[nodiscard]] f64 Elapsed() const noexcept
        {
            return std::chrono::duration<f64>(Now() - start_).count();
        }

    private:
        using TimePoint = std::chrono::steady_clock::time_point;
        static TimePoint Now() noexcept { return std::chrono::steady_clock::now(); }

        TimePoint start_;
        TimePoint last_;
    };
} // namespace inf
