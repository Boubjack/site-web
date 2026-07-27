// =============================================================================
//  Infinity Football — Engine / Core / Engine (implementation)
// =============================================================================
#include "Engine/Core/Engine.hpp"

#include <memory>

#include "Engine/Logging/Logger.hpp"
#include "Engine/Platform/Platform.hpp" // INF_PLATFORM_NAME / INF_COMPILER_NAME / INF_BUILD_NAME

namespace inf::core
{
    Engine::Engine()
        : save_("Saves"),          // reassigned to the configured dir in Initialize
          cameraCtl_(camera_)      // controller drives the owned camera
    {
    }

    void Engine::SetupLogging(const EngineConfig& config)
    {
        auto& logger = log::Logger::Default();
        logger.ClearSinks();
        if (config.logToConsole)
        {
            logger.AddSink(std::make_shared<log::ConsoleSink>());
        }
        logger.AddSink(std::make_shared<log::FileSink>(config.logFile));
    }

    bool Engine::Initialize(const EngineConfig& config)
    {
        if (initialized_) { return true; }

        SetupLogging(config);
        INF_LOG_INFO("Infinity Football engine starting ("
                     << INF_PLATFORM_NAME << ", " << INF_COMPILER_NAME << ", "
                     << INF_BUILD_NAME << ")");

        // --- Configuration --------------------------------------------------
        config_.LoadFile("engine", config.configDirectory + "/engine.cfg");
        config_.LoadFile("input", config.configDirectory + "/input.cfg");
        config_.LoadFile("logging", config.configDirectory + "/logging.cfg");

        // Apply the configured log level, if present.
        if (config_.Has("logging"))
        {
            const auto level = config_.Get("logging", "logging", "level").AsString();
            if (level == "trace") { log::Logger::Default().SetLevel(log::LogLevel::Trace); }
            else if (level == "debug") { log::Logger::Default().SetLevel(log::LogLevel::Debug); }
            else if (level == "warning") { log::Logger::Default().SetLevel(log::LogLevel::Warning); }
            else if (level == "error") { log::Logger::Default().SetLevel(log::LogLevel::Error); }
            // default remains Info
        }

        // --- Save system ----------------------------------------------------
        save_ = save::SaveManager(config.saveDirectory);

        // --- Audio ----------------------------------------------------------
        if (!audio_.Initialize())
        {
            INF_LOG_ERROR("Engine: audio failed to initialize");
            return false;
        }

        // --- Input ----------------------------------------------------------
        if (!input_.Initialize())
        {
            INF_LOG_ERROR("Engine: input failed to initialize");
            return false;
        }
        input_.LoadBindings(config_.File("input"));

        // --- Camera defaults (broadcast-style framing) ----------------------
        const f32 fov = static_cast<f32>(config_.Get("engine", "video", "fov").AsFloat(60.0));
        camera_.SetLens(fov, 16.0f / 9.0f, 0.1f, 1000.0f);

        // --- Flow ------------------------------------------------------------
        states_.Transition(loading::GameState::MainMenu);

        running_ = true;
        initialized_ = true;
        INF_LOG_INFO("Engine initialized: "
                     << config_.Count() << " config file(s), audio=" << audio_.BackendName()
                     << ", input=" << input_.BackendName());
        return true;
    }

    void Engine::Update(f64 deltaSeconds)
    {
        if (!running_) { return; }

        const f64 dt = deltaSeconds >= 0.0 ? deltaSeconds : clock_.Tick();

        input_.Update();
        cameraCtl_.Update(dt);
        audio_.Update(dt);

        ++frameCount_;
    }

    void Engine::Shutdown()
    {
        if (!initialized_) { return; }
        INF_LOG_INFO("Engine shutting down after " << frameCount_ << " frame(s)");

        states_.Transition(loading::GameState::Shutdown);
        menus_.Clear();
        loading_.Reset();
        resources_.Clear();
        input_.Shutdown();
        audio_.Shutdown();

        log::Logger::Default().Flush();
        running_ = false;
        initialized_ = false;
    }
} // namespace inf::core
