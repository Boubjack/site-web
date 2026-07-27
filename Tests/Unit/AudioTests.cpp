// Unit tests — Audio subsystem (facade over the Null backend).
#include <memory>

#include "Engine/Audio/AudioSystem.hpp"
#include "Engine/Audio/NullAudioBackend.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::audio;

INF_TEST(Audio_LoadPlayAndVolumeClamp)
{
    AudioSystem sys;
    auto backend = std::make_unique<NullAudioBackend>();
    NullAudioBackend* raw = backend.get();
    sys.SetBackend(std::move(backend));
    REQUIRE(sys.Initialize());
    REQUIRE(raw->Initialized());

    const SoundHandle h = sys.LoadSound("crowd.wav");
    REQUIRE(h != 0);
    REQUIRE_EQ(raw->LoadedCount(), static_cast<inf::usize>(1));

    sys.Play(h, AudioChannel::Crowd, 0.5f);
    REQUIRE_EQ(raw->PlayCount(), static_cast<inf::u64>(1));

    sys.SetMasterVolume(5.0f); // clamped to 1.0
    REQUIRE_EQ(sys.MasterVolume(), 1.0f);
    sys.SetMasterVolume(-1.0f); // clamped to 0.0
    REQUIRE_EQ(sys.MasterVolume(), 0.0f);

    sys.Shutdown();
    REQUIRE(!raw->Initialized());
}
