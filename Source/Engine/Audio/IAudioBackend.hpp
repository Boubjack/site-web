// =============================================================================
//  Infinity Football — Engine / Audio / IAudioBackend
//  Device-facing audio interface. A concrete backend (SDL2/OpenAL/WASAPI...) is
//  added in a later mission behind this interface; the engine and AudioSystem
//  facade never change when a real backend replaces the Null one.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::audio
{
    /// Opaque handle to a loaded sound. 0 is the invalid handle.
    using SoundHandle = u32;

    /// Logical mixing groups so volumes can be balanced independently
    /// (crowd, commentary, ball/net SFX, UI, music).
    enum class AudioChannel : u8
    {
        Master = 0,
        Crowd,
        Commentary,
        Effects,
        UI,
        Music,
        Count
    };

    class IAudioBackend
    {
    public:
        virtual ~IAudioBackend() = default;

        /// Prepare the device. Returns false if the backend cannot start.
        virtual bool Initialize() = 0;
        virtual void Shutdown() = 0;

        /// Load a sound from an asset path; returns 0 on failure.
        virtual SoundHandle LoadSound(const String& path) = 0;

        /// Start playback of a previously loaded sound on a channel.
        virtual void Play(SoundHandle sound, AudioChannel channel, f32 volume) = 0;
        virtual void StopAll() = 0;

        /// Per-channel and master gain in [0, 1].
        virtual void SetChannelVolume(AudioChannel channel, f32 volume) = 0;

        /// Advance the mixer by @p deltaSeconds (streaming, voice reclaim, ...).
        virtual void Update(f64 deltaSeconds) = 0;

        /// Human-readable backend name, for logs and diagnostics.
        [[nodiscard]] virtual const char* Name() const = 0;
    };
} // namespace inf::audio
