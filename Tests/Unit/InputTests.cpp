// Unit tests — Input subsystem (action mapping over a Null backend).
#include <memory>

#include "Engine/Config/ConfigFile.hpp"
#include "Engine/Input/InputSystem.hpp"
#include "Engine/Input/NullInputBackend.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::input;

INF_TEST(Input_ActionActiveAndEdgeDetection)
{
    InputSystem sys;
    auto backend = std::make_unique<NullInputBackend>();
    NullInputBackend* raw = backend.get();
    sys.SetBackend(std::move(backend));
    REQUIRE(sys.Initialize());

    sys.BindAction("Confirm", Key::Enter, GamepadButton::A);

    // Nothing pressed yet.
    sys.Update();
    REQUIRE(!sys.IsActionActive("Confirm"));

    // Press Enter -> active and freshly pressed this frame.
    raw->InjectKey(Key::Enter, true);
    sys.Update();
    REQUIRE(sys.IsActionActive("Confirm"));
    REQUIRE(sys.WasActionPressed("Confirm"));

    // Held -> still active but no longer a fresh press.
    sys.Update();
    REQUIRE(sys.IsActionActive("Confirm"));
    REQUIRE(!sys.WasActionPressed("Confirm"));

    // Gamepad button alone also activates the action.
    raw->InjectKey(Key::Enter, false);
    raw->InjectButton(GamepadButton::A, true);
    sys.Update();
    REQUIRE(sys.IsActionActive("Confirm"));
}

INF_TEST(Input_LoadBindingsFromConfig)
{
    InputSystem sys;
    sys.SetBackend(std::make_unique<NullInputBackend>());
    REQUIRE(sys.Initialize());

    const auto file = inf::config::ConfigFile::Parse(
        "[keyboard]\n"
        "MenuUp = Up\n"
        "Confirm = Enter\n"
        "[gamepad]\n"
        "Confirm = A\n");
    sys.LoadBindings(file);
    REQUIRE(sys.BindingCount() >= static_cast<inf::usize>(2));
}
