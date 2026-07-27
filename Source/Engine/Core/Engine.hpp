// =============================================================================
//  Infinity Football — Engine / Core / Engine
//  Composition root. Owns every subsystem, wires them together, and exposes an
//  Initialize / Update / Shutdown lifecycle. This is the single place that knows
//  about all subsystems; everything else depends only on the subsystems it uses,
//  keeping the dependency graph acyclic.
//
//  No gameplay lives here — Engine only starts and ticks the foundation.
// =============================================================================
#pragma once

#include "Engine/Audio/AudioSystem.hpp"
#include "Engine/Camera/Camera.hpp"
#include "Engine/Camera/CameraController.hpp"
#include "Engine/Config/ConfigManager.hpp"
#include "Engine/Core/Clock.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Events/EventBus.hpp"
#include "Engine/Input/InputSystem.hpp"
#include "Engine/Loading/LoadingQueue.hpp"
#include "Engine/Loading/StateMachine.hpp"
#include "Engine/Menu/MenuStack.hpp"
#include "Engine/Resources/ResourceManager.hpp"
#include "Engine/Save/SaveManager.hpp"

namespace inf::core
{
    /// Paths and options used to boot the engine. All optional; sensible
    /// defaults let the engine start with no files present.
    struct EngineConfig
    {
        String configDirectory{"Config"};
        String saveDirectory{"Saves"};
        String logFile{"Logs/infinity.log"};
        bool logToConsole{true};
    };

    class Engine
    {
    public:
        Engine();

        /// Brings up logging, loads configuration, and initializes every
        /// subsystem. Returns false if a critical subsystem fails.
        bool Initialize(const EngineConfig& config = {});

        /// Advances all subsystems by one frame. @p deltaSeconds is the frame
        /// time; when <= 0 the internal clock supplies it.
        void Update(f64 deltaSeconds = -1.0);

        /// Tears every subsystem down in reverse order. Idempotent.
        void Shutdown();

        [[nodiscard]] bool IsRunning() const noexcept { return running_; }
        [[nodiscard]] u64 FrameCount() const noexcept { return frameCount_; }

        // --- Subsystem access (composition, not inheritance) ----------------
        [[nodiscard]] config::ConfigManager& Config() noexcept { return config_; }
        [[nodiscard]] events::EventBus& Events() noexcept { return events_; }
        [[nodiscard]] resources::ResourceManager& Resources() noexcept { return resources_; }
        [[nodiscard]] save::SaveManager& Save() noexcept { return save_; }
        [[nodiscard]] audio::AudioSystem& Audio() noexcept { return audio_; }
        [[nodiscard]] input::InputSystem& Input() noexcept { return input_; }
        [[nodiscard]] camera::Camera& Camera() noexcept { return camera_; }
        [[nodiscard]] camera::CameraController& CameraController() noexcept { return cameraCtl_; }
        [[nodiscard]] menu::MenuStack& Menus() noexcept { return menus_; }
        [[nodiscard]] loading::LoadingQueue& Loading() noexcept { return loading_; }
        [[nodiscard]] loading::StateMachine& States() noexcept { return states_; }

    private:
        void SetupLogging(const EngineConfig& config);

        // Declared in initialization order (dependency order).
        config::ConfigManager config_;
        events::EventBus events_;
        resources::ResourceManager resources_;
        save::SaveManager save_;
        audio::AudioSystem audio_;
        input::InputSystem input_;
        camera::Camera camera_;
        camera::CameraController cameraCtl_;
        menu::MenuStack menus_;
        loading::LoadingQueue loading_;
        loading::StateMachine states_;
        Clock clock_;

        u64 frameCount_{0};
        bool running_{false};
        bool initialized_{false};
    };
} // namespace inf::core
