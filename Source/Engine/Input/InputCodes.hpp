// =============================================================================
//  Infinity Football — Engine / Input / InputCodes
//  Device-neutral identifiers for physical inputs. Backends translate their
//  native codes into these; the rest of the engine only ever sees these.
//  The set is intentionally small for the foundation and grows as needed.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::input
{
    /// Abstract keyboard keys (subset; extend as gameplay needs arise).
    enum class Key : u16
    {
        Unknown = 0,
        Up, Down, Left, Right,
        Enter, Escape, Space, Tab, Backspace,
        A, B, C, D, E, F, G, H, I, J, K, L, M,
        N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
        Num0, Num1, Num2, Num3, Num4, Num5, Num6, Num7, Num8, Num9,
        Count
    };

    /// Abstract gamepad buttons (Xbox-style naming, controller-agnostic).
    enum class GamepadButton : u8
    {
        Unknown = 0,
        A, B, X, Y,
        Up, Down, Left, Right,       // d-pad
        LeftBumper, RightBumper,
        LeftStick, RightStick,
        Start, Back,
        Count
    };

    /// Abstract gamepad analog axes, each reported in [-1, 1] (triggers [0, 1]).
    enum class GamepadAxis : u8
    {
        LeftX = 0, LeftY,
        RightX, RightY,
        LeftTrigger, RightTrigger,
        Count
    };

    /// Parse helpers so bindings can be expressed as text in config files.
    Key ParseKey(const String& name);
    GamepadButton ParseGamepadButton(const String& name);
} // namespace inf::input
