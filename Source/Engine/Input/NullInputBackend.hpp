// =============================================================================
//  Infinity Football — Engine / Input / NullInputBackend
//  Headless input backend. It reports no hardware activity by default but lets
//  callers (and tests) inject key/button/axis state programmatically, so the
//  full InputSystem action-mapping pipeline is exercisable without a device.
//  Real infrastructure, not a temporary stub.
// =============================================================================
#pragma once

#include <unordered_map>

#include "Engine/Core/Types.hpp"
#include "Engine/Input/IInputBackend.hpp"

namespace inf::input
{
    class NullInputBackend final : public IInputBackend
    {
    public:
        bool Initialize() override { return true; }
        void Shutdown() override
        {
            keys_.clear();
            buttons_.clear();
            axes_.clear();
        }
        void Poll() override { /* injected state persists until changed */ }

        [[nodiscard]] bool IsKeyDown(Key key) const override
        {
            const auto it = keys_.find(key);
            return it != keys_.end() && it->second;
        }
        [[nodiscard]] bool IsButtonDown(GamepadButton button) const override
        {
            const auto it = buttons_.find(button);
            return it != buttons_.end() && it->second;
        }
        [[nodiscard]] f32 GetAxis(GamepadAxis axis) const override
        {
            const auto it = axes_.find(axis);
            return it != axes_.end() ? it->second : 0.0f;
        }
        [[nodiscard]] bool IsGamepadConnected() const override { return gamepadConnected_; }

        [[nodiscard]] const char* Name() const override { return "Null"; }

        // --- Programmatic injection (tests / scripted demos) ----------------
        void InjectKey(Key key, bool down) { keys_[key] = down; }
        void InjectButton(GamepadButton button, bool down) { buttons_[button] = down; }
        void InjectAxis(GamepadAxis axis, f32 value) { axes_[axis] = value; }
        void SetGamepadConnected(bool connected) { gamepadConnected_ = connected; }

    private:
        std::unordered_map<Key, bool> keys_;
        std::unordered_map<GamepadButton, bool> buttons_;
        std::unordered_map<GamepadAxis, f32> axes_;
        bool gamepadConnected_{false};
    };
} // namespace inf::input
