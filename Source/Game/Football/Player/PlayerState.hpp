// =============================================================================
//  Infinity Football — Game / Football / Player / PlayerState
//  The player's discrete movement/action state. STATES ONLY — this mission does
//  not implement animation or behaviour; later missions drive transitions.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::football
{
    enum class PlayerState : u8
    {
        Idle = 0,
        Walk,
        Run,
        Sprint,
        Turn,
        Jump,
        Fall,
        Shoot,
        Pass,
        Cross,
        Tackle,
        Slide,
        Header
    };

    inline const char* ToString(PlayerState s) noexcept
    {
        switch (s)
        {
            case PlayerState::Idle:   return "Idle";
            case PlayerState::Walk:   return "Walk";
            case PlayerState::Run:    return "Run";
            case PlayerState::Sprint: return "Sprint";
            case PlayerState::Turn:   return "Turn";
            case PlayerState::Jump:   return "Jump";
            case PlayerState::Fall:   return "Fall";
            case PlayerState::Shoot:  return "Shoot";
            case PlayerState::Pass:   return "Pass";
            case PlayerState::Cross:  return "Cross";
            case PlayerState::Tackle: return "Tackle";
            case PlayerState::Slide:  return "Slide";
            case PlayerState::Header: return "Header";
        }
        return "Unknown";
    }
} // namespace inf::football
