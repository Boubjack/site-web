// =============================================================================
//  Infinity Football — Engine / Input / InputSystem
//  Maps physical inputs to named, data-driven actions ("MenuUp", "Confirm",
//  ...) loaded from configuration, so bindings are rebindable and gameplay code
//  never references raw keys. Supports both keyboard and gamepad simultaneously
//  (an action is active if either bound control is active).
// =============================================================================
#pragma once

#include <map>
#include <memory>

#include "Engine/Core/Types.hpp"
#include "Engine/Input/IInputBackend.hpp"
#include "Engine/Input/InputCodes.hpp"

namespace inf::config { class ConfigFile; }

namespace inf::input
{
    /// One action's bound controls (either or both may be set).
    struct ActionBinding
    {
        Key key{Key::Unknown};
        GamepadButton button{GamepadButton::Unknown};
    };

    class InputSystem
    {
    public:
        InputSystem();

        /// Replaces the backend (e.g. inject a real device backend). Call
        /// before Initialize().
        void SetBackend(std::unique_ptr<IInputBackend> backend);

        bool Initialize();
        void Shutdown();

        /// Poll the device and refresh per-action state. Call once per frame.
        void Update();

        /// Bind a named action to a keyboard key and/or gamepad button.
        void BindAction(const String& action, Key key, GamepadButton button);

        /// Load bindings from an [keyboard]/[gamepad] config file. Sections map
        /// action name -> control name (see Config/input.cfg).
        void LoadBindings(const config::ConfigFile& file);

        /// True while the action's control is held this frame.
        [[nodiscard]] bool IsActionActive(const String& action) const;

        /// True on the frame the action transitioned from up to down.
        [[nodiscard]] bool WasActionPressed(const String& action) const;

        [[nodiscard]] usize BindingCount() const noexcept { return bindings_.size(); }
        [[nodiscard]] const char* BackendName() const;

    private:
        [[nodiscard]] bool EvaluateActive(const ActionBinding& binding) const;

        std::unique_ptr<IInputBackend> backend_;
        std::map<String, ActionBinding> bindings_;
        std::map<String, bool> active_;   // state this frame
        std::map<String, bool> previous_; // state last frame
    };
} // namespace inf::input
