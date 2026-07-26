// =============================================================================
//  Infinity Football — Engine / Loading / LoadingQueue (implementation)
// =============================================================================
#include "Engine/Loading/LoadingQueue.hpp"

namespace inf::loading
{
    namespace
    {
        const String kEmptyLabel{};
    }

    void LoadingQueue::Enqueue(String label, std::function<void()> work)
    {
        tasks_.push_back(LoadingTask{std::move(label), std::move(work)});
    }

    bool LoadingQueue::Step()
    {
        if (IsFinished()) { return false; }
        auto& task = tasks_[completed_];
        if (task.work) { task.work(); }
        ++completed_;
        return !IsFinished();
    }

    void LoadingQueue::RunAll()
    {
        // Step() processes one task per call and returns false once the last
        // one has run, so this loop drains the whole queue (including a queue
        // with a single task).
        while (Step()) { /* keep stepping until finished */ }
    }

    f32 LoadingQueue::Progress() const noexcept
    {
        if (tasks_.empty()) { return 1.0f; }
        return static_cast<f32>(completed_) / static_cast<f32>(tasks_.size());
    }

    const String& LoadingQueue::CurrentLabel() const
    {
        return IsFinished() ? kEmptyLabel : tasks_[completed_].label;
    }

    void LoadingQueue::Reset()
    {
        tasks_.clear();
        completed_ = 0;
    }
} // namespace inf::loading
