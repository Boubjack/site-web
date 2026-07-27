// =============================================================================
//  Infinity Football — Engine / Audio / AudioSystem
//  Engine-facing audio facade. Owns a backend (Null by default), keeps the
//  master/channel volume model, and forwards play requests. Game code talks to
//  AudioSystem only, never to a concrete device backend.
// =============================================================================
#pragma once

#include <memory>

#include "Engine/Audio/IAudioBackend.hpp"
#include "Engine/Core/Types.hpp"

namespace inf::audio
{
    class AudioSystem
    {
    public:
        AudioSystem();

        /// Replaces the active backend (e.g. inject a real device backend).
        /// Must be called before Initialize().
        void SetBackend(std::unique_ptr<IAudioBackend> backend);

        bool Initialize();
        void Shutdown();
        void Update(f64 deltaSeconds);

        SoundHandle LoadSound(const String& path);
        void Play(SoundHandle sound, AudioChannel channel = AudioChannel::Effects,
                  f32 volume = 1.0f);
        void StopAll();

        /// Master gain in [0, 1]; clamped.
        void SetMasterVolume(f32 volume);
        [[nodiscard]] f32 MasterVolume() const noexcept { return masterVolume_; }

        void SetChannelVolume(AudioChannel channel, f32 volume);

        [[nodiscard]] const char* BackendName() const;

    private:
        std::unique_ptr<IAudioBackend> backend_;
        f32 masterVolume_{1.0f};
        bool initialized_{false};
    };
} // namespace inf::audio
