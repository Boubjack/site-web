// =============================================================================
//  Infinity Football — Engine / Core / Application (implementation)
// =============================================================================
#include "Engine/Core/Application.hpp"

#include "Engine/Logging/Logger.hpp"

namespace inf::core
{
    int Application::Run(const EngineConfig& config)
    {
        if (!engine_.Initialize(config))
        {
            return 1;
        }

        // Fixed timestep for deterministic headless runs (60 Hz).
        constexpr f64 kFixedDelta = 1.0 / 60.0;

        while (!stopRequested_)
        {
            engine_.Update(kFixedDelta);

            if (maxFrames_ != 0 && engine_.FrameCount() >= maxFrames_)
            {
                break;
            }
        }

        INF_LOG_INFO("Application loop finished after " << engine_.FrameCount() << " frame(s)");
        engine_.Shutdown();
        return 0;
    }
} // namespace inf::core
