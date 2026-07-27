// =============================================================================
//  Infinity Football — Engine / Logging / Logger
//  Central, thread-safe logger. Fans a message out to every registered sink
//  once it passes the active level threshold. A process-wide default instance
//  backs the INF_LOG_* macros for convenience, but Logger is a plain object
//  that can also be owned and injected explicitly.
// =============================================================================
#pragma once

#include <memory>
#include <mutex>
#include <sstream>
#include <utility>
#include <vector>

#include "Engine/Core/Types.hpp"
#include "Engine/Logging/LogLevel.hpp"
#include "Engine/Logging/LogSink.hpp"

namespace inf::log
{
    class Logger
    {
    public:
        /// The process-wide logger used by the INF_LOG_* macros.
        static Logger& Default();

        /// Messages below this level are dropped. Defaults to Info.
        void SetLevel(LogLevel level) noexcept { level_ = level; }
        [[nodiscard]] LogLevel Level() const noexcept { return level_; }

        /// Registers a sink. Ownership is shared so a sink may be reused.
        void AddSink(std::shared_ptr<ILogSink> sink);
        /// Removes every registered sink.
        void ClearSinks();
        [[nodiscard]] usize SinkCount() const;

        /// Formats and dispatches a message if @p level passes the threshold.
        void Log(LogLevel level, const String& message);

        void Flush();

    private:
        String Format(LogLevel level, const String& message) const;

        mutable std::mutex mutex_;
        std::vector<std::shared_ptr<ILogSink>> sinks_;
        LogLevel level_{LogLevel::Info};
    };
} // namespace inf::log

// --- Convenience macros -----------------------------------------------------
// Arguments are streamed, so callers can write: INF_LOG_INFO("x=" << x).
#define INF_LOG(level, msg)                                                        \
    do {                                                                           \
        ::std::ostringstream _inf_oss;                                             \
        _inf_oss << msg;                                                           \
        ::inf::log::Logger::Default().Log((level), _inf_oss.str());                \
    } while (false)

#define INF_LOG_TRACE(msg) INF_LOG(::inf::log::LogLevel::Trace, msg)
#define INF_LOG_DEBUG(msg) INF_LOG(::inf::log::LogLevel::Debug, msg)
#define INF_LOG_INFO(msg)  INF_LOG(::inf::log::LogLevel::Info, msg)
#define INF_LOG_WARN(msg)  INF_LOG(::inf::log::LogLevel::Warning, msg)
#define INF_LOG_ERROR(msg) INF_LOG(::inf::log::LogLevel::Error, msg)
#define INF_LOG_CRIT(msg)  INF_LOG(::inf::log::LogLevel::Critical, msg)
