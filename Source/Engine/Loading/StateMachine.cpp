// =============================================================================
//  Infinity Football — Engine / Loading / StateMachine (implementation)
// =============================================================================
#include "Engine/Loading/StateMachine.hpp"

namespace inf::loading
{
    const char* ToString(GameState state) noexcept
    {
        switch (state)
        {
            case GameState::Boot:     return "Boot";
            case GameState::MainMenu: return "MainMenu";
            case GameState::Loading:  return "Loading";
            case GameState::InGame:   return "InGame";
            case GameState::Paused:   return "Paused";
            case GameState::Shutdown: return "Shutdown";
        }
        return "Unknown";
    }

    void StateMachine::Transition(GameState next)
    {
        if (next == current_) { return; }

        if (const auto exit = onExit_.find(current_); exit != onExit_.end() && exit->second)
        {
            exit->second();
        }
        current_ = next;
        if (const auto enter = onEnter_.find(current_); enter != onEnter_.end() && enter->second)
        {
            enter->second();
        }
    }
} // namespace inf::loading
