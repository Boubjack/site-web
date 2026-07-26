// =============================================================================
//  Infinity Football — Engine / Loading / StateMachine
//  High-level application/game flow states and a minimal state machine with
//  enter/exit hooks. These are engine-flow states (Boot, MainMenu, Loading,
//  ...), NOT gameplay logic — the match/gameplay states are added by later
//  missions by extending GameState and registering their own callbacks.
// =============================================================================
#pragma once

#include <functional>
#include <map>

#include "Engine/Core/Types.hpp"

namespace inf::loading
{
    /// Coarse application flow states. Extend as new screens are added.
    enum class GameState : u8
    {
        Boot = 0,   ///< Engine starting up.
        MainMenu,   ///< Front-end menu is active.
        Loading,    ///< A LoadingQueue is running.
        InGame,     ///< A session/screen is active (populated by later missions).
        Paused,     ///< In-game but paused.
        Shutdown    ///< Engine tearing down.
    };

    const char* ToString(GameState state) noexcept;

    /// Simple flat state machine with optional enter/exit callbacks per state.
    class StateMachine
    {
    public:
        using Callback = std::function<void()>;

        explicit StateMachine(GameState initial = GameState::Boot) : current_(initial) {}

        void OnEnter(GameState state, Callback cb) { onEnter_[state] = std::move(cb); }
        void OnExit(GameState state, Callback cb) { onExit_[state] = std::move(cb); }

        /// Transitions to @p next, firing the current state's exit callback and
        /// the next state's enter callback. A transition to the same state is a
        /// no-op.
        void Transition(GameState next);

        [[nodiscard]] GameState Current() const noexcept { return current_; }

    private:
        GameState current_;
        std::map<GameState, Callback> onEnter_;
        std::map<GameState, Callback> onExit_;
    };
} // namespace inf::loading
