// =============================================================================
//  Infinity Football — Engine / Logging / LogLevel
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::log
{
    /// Severity levels, ordered from most to least verbose.
    enum class LogLevel : u8
    {
        Trace = 0,
        Debug,
        Info,
        Warning,
        Error,
        Critical,
        Off
    };

    /// Short, fixed-width tag for a level (used by sinks when formatting).
    inline const char* ToString(LogLevel level) noexcept
    {
        switch (level)
        {
            case LogLevel::Trace:    return "TRACE";
            case LogLevel::Debug:    return "DEBUG";
            case LogLevel::Info:     return "INFO ";
            case LogLevel::Warning:  return "WARN ";
            case LogLevel::Error:    return "ERROR";
            case LogLevel::Critical: return "CRIT ";
            case LogLevel::Off:      return "OFF  ";
        }
        return "?????";
    }
} // namespace inf::log
