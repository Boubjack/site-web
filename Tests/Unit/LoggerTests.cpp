// Unit tests — Logging subsystem (sinks + level threshold).
#include <memory>
#include <vector>

#include "Engine/Logging/Logger.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::log;

namespace
{
    /// Test sink that records every line it receives.
    class MemorySink final : public ILogSink
    {
    public:
        void Write(LogLevel, const inf::String& line) override { lines.push_back(line); }
        std::vector<inf::String> lines;
    };
} // namespace

INF_TEST(Logger_DispatchesToSink)
{
    Logger logger;
    auto sink = std::make_shared<MemorySink>();
    logger.AddSink(sink);
    logger.SetLevel(LogLevel::Info);

    logger.Log(LogLevel::Info, "hello");
    REQUIRE_EQ(sink->lines.size(), static_cast<inf::usize>(1));
    REQUIRE(sink->lines[0].find("hello") != inf::String::npos);
    REQUIRE(sink->lines[0].find("INFO") != inf::String::npos);
}

INF_TEST(Logger_RespectsLevelThreshold)
{
    Logger logger;
    auto sink = std::make_shared<MemorySink>();
    logger.AddSink(sink);
    logger.SetLevel(LogLevel::Warning);

    logger.Log(LogLevel::Info, "dropped");   // below threshold
    logger.Log(LogLevel::Error, "kept");     // above threshold
    REQUIRE_EQ(sink->lines.size(), static_cast<inf::usize>(1));
    REQUIRE(sink->lines[0].find("kept") != inf::String::npos);
}

INF_TEST(Logger_SinkManagement)
{
    Logger logger;
    logger.AddSink(std::make_shared<MemorySink>());
    logger.AddSink(std::make_shared<MemorySink>());
    REQUIRE_EQ(logger.SinkCount(), static_cast<inf::usize>(2));
    logger.ClearSinks();
    REQUIRE_EQ(logger.SinkCount(), static_cast<inf::usize>(0));
}
