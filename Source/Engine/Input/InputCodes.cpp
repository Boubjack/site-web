// =============================================================================
//  Infinity Football — Engine / Input / InputCodes (implementation)
// =============================================================================
#include "Engine/Input/InputCodes.hpp"

#include <unordered_map>

namespace inf::input
{
    Key ParseKey(const String& name)
    {
        static const std::unordered_map<String, Key> table = {
            {"Up", Key::Up},       {"Down", Key::Down},   {"Left", Key::Left},
            {"Right", Key::Right}, {"Enter", Key::Enter}, {"Escape", Key::Escape},
            {"Space", Key::Space}, {"Tab", Key::Tab},     {"Backspace", Key::Backspace},
            {"A", Key::A}, {"B", Key::B}, {"C", Key::C}, {"D", Key::D}, {"E", Key::E},
            {"F", Key::F}, {"G", Key::G}, {"H", Key::H}, {"I", Key::I}, {"J", Key::J},
            {"K", Key::K}, {"L", Key::L}, {"M", Key::M}, {"N", Key::N}, {"O", Key::O},
            {"P", Key::P}, {"Q", Key::Q}, {"R", Key::R}, {"S", Key::S}, {"T", Key::T},
            {"U", Key::U}, {"V", Key::V}, {"W", Key::W}, {"X", Key::X}, {"Y", Key::Y},
            {"Z", Key::Z},
        };
        const auto it = table.find(name);
        return it != table.end() ? it->second : Key::Unknown;
    }

    GamepadButton ParseGamepadButton(const String& name)
    {
        static const std::unordered_map<String, GamepadButton> table = {
            {"A", GamepadButton::A},           {"B", GamepadButton::B},
            {"X", GamepadButton::X},           {"Y", GamepadButton::Y},
            {"Up", GamepadButton::Up},         {"Down", GamepadButton::Down},
            {"Left", GamepadButton::Left},     {"Right", GamepadButton::Right},
            {"LeftBumper", GamepadButton::LeftBumper},
            {"RightBumper", GamepadButton::RightBumper},
            {"LeftStick", GamepadButton::LeftStick},
            {"RightStick", GamepadButton::RightStick},
            {"Start", GamepadButton::Start},   {"Back", GamepadButton::Back},
        };
        const auto it = table.find(name);
        return it != table.end() ? it->second : GamepadButton::Unknown;
    }
} // namespace inf::input
