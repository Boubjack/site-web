// =============================================================================
//  Infinity Football — Engine / Loading / LoadingQueue
//  Drives a sequence of loading steps one at a time so a loading screen can show
//  real, monotonic progress. Each task is a small unit of work (load a bank,
//  parse a data table, warm a cache) supplied as a callback — the queue knows
//  nothing about what is being loaded.
// =============================================================================
#pragma once

#include <functional>
#include <vector>

#include "Engine/Core/Types.hpp"

namespace inf::loading
{
    /// One unit of loading work. @p work performs the step; it runs once.
    struct LoadingTask
    {
        String label;
        std::function<void()> work;
    };

    class LoadingQueue
    {
    public:
        void Enqueue(String label, std::function<void()> work);

        /// Runs the next pending task. Returns true while work remains.
        bool Step();

        /// Runs every remaining task to completion.
        void RunAll();

        /// Fraction complete in [0, 1]. 1.0 when empty or fully processed.
        [[nodiscard]] f32 Progress() const noexcept;

        /// Label of the task that will run next (empty when finished).
        [[nodiscard]] const String& CurrentLabel() const;

        [[nodiscard]] bool IsFinished() const noexcept { return completed_ >= tasks_.size(); }
        [[nodiscard]] usize Total() const noexcept { return tasks_.size(); }
        [[nodiscard]] usize Completed() const noexcept { return completed_; }
        void Reset();

    private:
        std::vector<LoadingTask> tasks_;
        usize completed_{0};
    };
} // namespace inf::loading
