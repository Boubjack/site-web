// =============================================================================
//  Infinity Football — Engine / Logging / LogSink
//  Sink abstraction: where formatted log lines are written. New destinations
//  (network, in-game console, rotating files) implement ILogSink without
//  touching the Logger — Open/Closed Principle.
// =============================================================================
#pragma once

#include <cstdio>
#include <mutex>

#include "Engine/Core/Types.hpp"
#include "Engine/Logging/LogLevel.hpp"

namespace inf::log
{
    /// Destination for fully-formatted log lines.
    class ILogSink
    {
    public:
        virtual ~ILogSink() = default;
        /// Write one already-formatted line (without trailing newline).
        virtual void Write(LogLevel level, const String& line) = 0;
        /// Flush any buffered output.
        virtual void Flush() {}
    };

    /// Writes to stdout/stderr. Thread-safe.
    class ConsoleSink final : public ILogSink
    {
    public:
        void Write(LogLevel level, const String& line) override
        {
            std::lock_guard<std::mutex> lock(mutex_);
            std::FILE* out = level >= LogLevel::Error ? stderr : stdout;
            std::fprintf(out, "%s\n", line.c_str());
        }
        void Flush() override
        {
            std::fflush(stdout);
            std::fflush(stderr);
        }

    private:
        std::mutex mutex_;
    };

    /// Appends to a file on disk. Thread-safe. Silently degrades to a no-op if
    /// the file cannot be opened, so logging never crashes the engine.
    class FileSink final : public ILogSink
    {
    public:
        explicit FileSink(const String& path) { file_ = std::fopen(path.c_str(), "a"); }
        ~FileSink() override
        {
            if (file_) { std::fclose(file_); }
        }

        void Write(LogLevel level, const String& line) override
        {
            (void)level;
            if (!file_) { return; }
            std::lock_guard<std::mutex> lock(mutex_);
            std::fprintf(file_, "%s\n", line.c_str());
        }
        void Flush() override
        {
            if (file_) { std::fflush(file_); }
        }

        [[nodiscard]] bool IsOpen() const noexcept { return file_ != nullptr; }

    private:
        std::FILE* file_{nullptr};
        std::mutex mutex_;
    };
} // namespace inf::log
