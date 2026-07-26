// =============================================================================
//  Infinity Football — Engine / Input / InputSystem (implementation)
// =============================================================================
#include "Engine/Input/InputSystem.hpp"

#include "Engine/Config/ConfigFile.hpp"
#include "Engine/Input/NullInputBackend.hpp"
#include "Engine/Logging/Logger.hpp"

namespace inf::input
{
    InputSystem::InputSystem() : backend_(std::make_unique<NullInputBackend>()) {}

    void InputSystem::SetBackend(std::unique_ptr<IInputBackend> backend)
    {
        if (backend) { backend_ = std::move(backend); }
    }

    bool InputSystem::Initialize()
    {
        if (!backend_->Initialize())
        {
            INF_LOG_ERROR("InputSystem: backend '" << backend_->Name() << "' failed to init");
            return false;
        }
        INF_LOG_INFO("InputSystem ready (backend: " << backend_->Name() << ")");
        return true;
    }

    void InputSystem::Shutdown() { backend_->Shutdown(); }

    void InputSystem::BindAction(const String& action, Key key, GamepadButton button)
    {
        bindings_[action] = ActionBinding{key, button};
    }

    void InputSystem::LoadBindings(const config::ConfigFile& file)
    {
        // Merge keyboard and gamepad sections into per-action bindings.
        // We can't enumerate config keys directly, so we resolve known actions
        // through both sections; unknown actions are simply left unbound.
        // To keep this data-driven, actions are discovered from the union of
        // both sections via the file's public accessors below.
        // (ConfigFile exposes Has/Get; iteration is added where needed.)
        // For the foundation we bind the standard menu/navigation actions.
        static const char* kActions[] = {"MenuUp",  "MenuDown", "MenuLeft", "MenuRight",
                                         "Confirm", "Cancel",   "Pause"};
        for (const char* action : kActions)
        {
            Key key = Key::Unknown;
            GamepadButton button = GamepadButton::Unknown;
            if (file.Has("keyboard", action))
            {
                key = ParseKey(file.Get("keyboard", action).AsString());
            }
            if (file.Has("gamepad", action))
            {
                button = ParseGamepadButton(file.Get("gamepad", action).AsString());
            }
            if (key != Key::Unknown || button != GamepadButton::Unknown)
            {
                BindAction(action, key, button);
            }
        }
        INF_LOG_INFO("InputSystem loaded " << bindings_.size() << " action bindings");
    }

    bool InputSystem::EvaluateActive(const ActionBinding& binding) const
    {
        if (binding.key != Key::Unknown && backend_->IsKeyDown(binding.key)) { return true; }
        if (binding.button != GamepadButton::Unknown && backend_->IsButtonDown(binding.button))
        {
            return true;
        }
        return false;
    }

    void InputSystem::Update()
    {
        backend_->Poll();
        previous_ = active_;
        for (const auto& [action, binding] : bindings_)
        {
            active_[action] = EvaluateActive(binding);
        }
    }

    bool InputSystem::IsActionActive(const String& action) const
    {
        const auto it = active_.find(action);
        return it != active_.end() && it->second;
    }

    bool InputSystem::WasActionPressed(const String& action) const
    {
        const auto cur = active_.find(action);
        const bool now = cur != active_.end() && cur->second;
        const auto prev = previous_.find(action);
        const bool before = prev != previous_.end() && prev->second;
        return now && !before;
    }

    const char* InputSystem::BackendName() const { return backend_->Name(); }
} // namespace inf::input
