// =============================================================================
//  Infinity Football — Engine / Input / IInputBackend
//  Device-facing input interface. A concrete backend (SDL2 keyboard + game
//  controller) is added later behind this interface; InputSystem and all
//  callers stay unchanged.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Input/InputCodes.hpp"

namespace inf::input
{
    class IInputBackend
    {
    public:
        virtual ~IInputBackend() = default;

        virtual bool Initialize() = 0;
        virtual void Shutdown() = 0;

        /// Refresh the device state snapshot for this frame.
        virtual void Poll() = 0;

        [[nodiscard]] virtual bool IsKeyDown(Key key) const = 0;
        [[nodiscard]] virtual bool IsButtonDown(GamepadButton button) const = 0;
        [[nodiscard]] virtual f32 GetAxis(GamepadAxis axis) const = 0;
        [[nodiscard]] virtual bool IsGamepadConnected() const = 0;

        [[nodiscard]] virtual const char* Name() const = 0;
    };
} // namespace inf::input
