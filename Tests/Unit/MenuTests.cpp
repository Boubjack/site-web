// Unit tests — Menu subsystem (navigation + stack).
#include <memory>

#include "Engine/Menu/MenuModel.hpp"
#include "Engine/Menu/MenuStack.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::menu;

INF_TEST(Menu_NavigationWrapsAndActivates)
{
    MenuModel m("Main");
    int chosen = -1;
    m.AddItem({"a", "Play", true, [&] { chosen = 0; }});
    m.AddItem({"b", "Options", true, [&] { chosen = 1; }});
    m.AddItem({"c", "Quit", true, [&] { chosen = 2; }});

    REQUIRE_EQ(m.SelectedIndex(), static_cast<inf::usize>(0));
    m.MoveDown();
    REQUIRE_EQ(m.SelectedIndex(), static_cast<inf::usize>(1));
    m.Activate();
    REQUIRE_EQ(chosen, 1);

    m.MoveUp(); // 1 -> 0
    m.MoveUp(); // 0 -> wraps to 2
    REQUIRE_EQ(m.SelectedIndex(), static_cast<inf::usize>(2));
}

INF_TEST(Menu_SkipsDisabledItems)
{
    MenuModel m;
    m.AddItem({"a", "Enabled", true, nullptr});
    m.AddItem({"b", "Disabled", false, nullptr});
    m.AddItem({"c", "Enabled2", true, nullptr});

    m.MoveDown(); // from 0, skip disabled 1, land on 2
    REQUIRE_EQ(m.SelectedIndex(), static_cast<inf::usize>(2));
}

INF_TEST(Menu_StackPushPop)
{
    MenuStack stack;
    REQUIRE(stack.Empty());
    stack.Push(std::make_shared<MenuModel>("Root"));
    stack.Push(std::make_shared<MenuModel>("Sub"));
    REQUIRE_EQ(stack.Depth(), static_cast<inf::usize>(2));
    REQUIRE_EQ(stack.Current()->Title(), inf::String("Sub"));

    REQUIRE(stack.Pop());  // back to Root, still non-empty
    REQUIRE_EQ(stack.Current()->Title(), inf::String("Root"));
    REQUIRE(!stack.Pop()); // now empty
    REQUIRE(stack.Empty());
}
