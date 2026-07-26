// =============================================================================
//  Infinity Football — Engine / Logging / Logger (implementation)
// =============================================================================
#include "Engine/Logging/Logger.hpp"

#include <chrono>
#include <cstdio>
#include <ctime>

#include "Engine/Platform/Platform.hpp" // INF_PLATFORM_WINDOWS

namespace inf::log
{
    Logger& Logger::Default()
    {
        static Logger instance;
        return instance;
    }

    void Logger::AddSink(std::shared_ptr<ILogSink> sink)
    {
        if (!sink) { return; }
        std::lock_guard<std::mutex> lock(mutex_);
        sinks_.push_back(std::move(sink));
    }

    void Logger::ClearSinks()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        sinks_.clear();
    }

    usize Logger::SinkCount() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return sinks_.size();
    }

    void Logger::Log(LogLevel level, const String& message)
    {
        if (level < level_ || level == LogLevel::Off) { return; }

        const String line = Format(level, message);

        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& sink : sinks_)
        {
            sink->Write(level, line);
        }
    }

    void Logger::Flush()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& sink : sinks_)
        {
            sink->Flush();
        }
    }

    String Logger::Format(LogLevel level, const String& message) const
    {
        // Wall-clock timestamp with second resolution: HH:MM:SS.
        const auto now = std::chrono::system_clock::now();
        const std::time_t t = std::chrono::system_clock::to_time_t(now);
        std::tm tm{};
#if defined(INF_PLATFORM_WINDOWS)
        localtime_s(&tm, &t);
#else
        localtime_r(&t, &tm);
#endif
        char stamp[16];
        std::snprintf(stamp, sizeof(stamp), "%02d:%02d:%02d", tm.tm_hour, tm.tm_min, tm.tm_sec);

        String out;
        out.reserve(message.size() + 24);
        out += '[';
        out += stamp;
        out += "] [";
        out += ToString(level);
        out += "] ";
        out += message;
        return out;
    }
} // namespace inf::log
