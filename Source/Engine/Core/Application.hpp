// =============================================================================
//  Infinity Football — Engine / Core / Application
//  Thin driver around Engine that owns the main loop. For the foundation it
//  runs headless for a bounded number of frames (so it terminates in tests/CI);
//  a windowed loop added later reuses the same Engine lifecycle unchanged.
// =============================================================================
#pragma once

#include "Engine/Core/Engine.hpp"
#include "Engine/Core/Types.hpp"

namespace inf::core
{
    class Application
    {
    public:
        /// @p maxFrames > 0 runs a bounded loop (headless/testing). 0 means run
        /// until Stop() is called (for a future real-time loop).
        explicit Application(u64 maxFrames = 0) : maxFrames_(maxFrames) {}

        /// Initializes the engine, runs the loop, then shuts down. Returns the
        /// process exit code (0 on success).
        int Run(const EngineConfig& config = {});

        /// Requests the loop to stop after the current frame.
        void Stop() noexcept { stopRequested_ = true; }

        [[nodiscard]] Engine& GetEngine() noexcept { return engine_; }

    private:
        Engine engine_;
        u64 maxFrames_;
        bool stopRequested_{false};
    };
} // namespace inf::core
