// Unit tests — Loading subsystem (task queue + state machine).
#include "Engine/Loading/LoadingQueue.hpp"
#include "Engine/Loading/StateMachine.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::loading;

INF_TEST(Loading_QueueProgress)
{
    LoadingQueue q;
    int ran = 0;
    q.Enqueue("one", [&] { ++ran; });
    q.Enqueue("two", [&] { ++ran; });

    REQUIRE(q.Progress() < 0.5f);
    REQUIRE_EQ(q.CurrentLabel(), inf::String("one"));

    REQUIRE(q.Step());  // runs "one", work remains
    REQUIRE(!q.Step()); // runs "two", now finished
    REQUIRE(q.IsFinished());
    REQUIRE_EQ(ran, 2);
    REQUIRE(q.Progress() > 0.999f);
}

INF_TEST(Loading_EmptyQueueIsComplete)
{
    LoadingQueue q;
    REQUIRE(q.IsFinished());
    REQUIRE(q.Progress() > 0.999f);
    REQUIRE(!q.Step());
}

INF_TEST(Loading_StateMachineFiresCallbacks)
{
    StateMachine sm(GameState::Boot);
    int entered = 0;
    int exited = 0;
    sm.OnExit(GameState::Boot, [&] { ++exited; });
    sm.OnEnter(GameState::MainMenu, [&] { ++entered; });

    sm.Transition(GameState::MainMenu);
    REQUIRE(sm.Current() == GameState::MainMenu);
    REQUIRE_EQ(entered, 1);
    REQUIRE_EQ(exited, 1);

    // Transition to the same state is a no-op.
    sm.Transition(GameState::MainMenu);
    REQUIRE_EQ(entered, 1);
}
