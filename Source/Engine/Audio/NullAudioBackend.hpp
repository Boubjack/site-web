// =============================================================================
//  Infinity Football — Engine / Audio / NullAudioBackend
//  Fully-functional headless backend: it honours the whole IAudioBackend
//  contract (handles, channels, volumes) without touching a sound device. This
//  is real infrastructure — it lets the engine, tests and CI run everywhere —
//  not a temporary stub. A real device backend slots in behind IAudioBackend
//  later without changing any caller.
// =============================================================================
#pragma once

#include <unordered_map>

#include "Engine/Audio/IAudioBackend.hpp"
#include "Engine/Core/Types.hpp"

namespace inf::audio
{
    class NullAudioBackend final : public IAudioBackend
    {
    public:
        bool Initialize() override
        {
            initialized_ = true;
            return true;
        }

        void Shutdown() override
        {
            sounds_.clear();
            playCount_ = 0;
            initialized_ = false;
        }

        SoundHandle LoadSound(const String& path) override
        {
            const SoundHandle handle = ++nextHandle_;
            sounds_[handle] = path;
            return handle;
        }

        void Play(SoundHandle sound, AudioChannel /*channel*/, f32 /*volume*/) override
        {
            if (sounds_.count(sound) != 0) { ++playCount_; }
        }

        void StopAll() override { /* nothing is really playing */ }

        void SetChannelVolume(AudioChannel channel, f32 volume) override
        {
            volumes_[static_cast<usize>(channel)] = volume;
        }

        void Update(f64 /*deltaSeconds*/) override {}

        [[nodiscard]] const char* Name() const override { return "Null"; }

        // --- Introspection (used by tests) ----------------------------------
        [[nodiscard]] bool Initialized() const noexcept { return initialized_; }
        [[nodiscard]] usize LoadedCount() const noexcept { return sounds_.size(); }
        [[nodiscard]] u64 PlayCount() const noexcept { return playCount_; }

    private:
        std::unordered_map<SoundHandle, String> sounds_;
        f32 volumes_[static_cast<usize>(AudioChannel::Count)]{};
        SoundHandle nextHandle_{0};
        u64 playCount_{0};
        bool initialized_{false};
    };
} // namespace inf::audio
