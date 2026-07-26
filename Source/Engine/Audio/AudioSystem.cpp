// =============================================================================
//  Infinity Football — Engine / Audio / AudioSystem (implementation)
// =============================================================================
#include "Engine/Audio/AudioSystem.hpp"

#include "Engine/Audio/NullAudioBackend.hpp"
#include "Engine/Logging/Logger.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::audio
{
    AudioSystem::AudioSystem() : backend_(std::make_unique<NullAudioBackend>()) {}

    void AudioSystem::SetBackend(std::unique_ptr<IAudioBackend> backend)
    {
        if (backend) { backend_ = std::move(backend); }
    }

    bool AudioSystem::Initialize()
    {
        if (!backend_->Initialize())
        {
            INF_LOG_ERROR("AudioSystem: backend '" << backend_->Name() << "' failed to init");
            return false;
        }
        initialized_ = true;
        INF_LOG_INFO("AudioSystem ready (backend: " << backend_->Name() << ")");
        return true;
    }

    void AudioSystem::Shutdown()
    {
        if (!initialized_) { return; }
        backend_->Shutdown();
        initialized_ = false;
    }

    void AudioSystem::Update(f64 deltaSeconds) { backend_->Update(deltaSeconds); }

    SoundHandle AudioSystem::LoadSound(const String& path) { return backend_->LoadSound(path); }

    void AudioSystem::Play(SoundHandle sound, AudioChannel channel, f32 volume)
    {
        backend_->Play(sound, channel, math::Clamp(volume, 0.0f, 1.0f) * masterVolume_);
    }

    void AudioSystem::StopAll() { backend_->StopAll(); }

    void AudioSystem::SetMasterVolume(f32 volume)
    {
        masterVolume_ = math::Clamp(volume, 0.0f, 1.0f);
        backend_->SetChannelVolume(AudioChannel::Master, masterVolume_);
    }

    void AudioSystem::SetChannelVolume(AudioChannel channel, f32 volume)
    {
        backend_->SetChannelVolume(channel, math::Clamp(volume, 0.0f, 1.0f));
    }

    const char* AudioSystem::BackendName() const { return backend_->Name(); }
} // namespace inf::audio
