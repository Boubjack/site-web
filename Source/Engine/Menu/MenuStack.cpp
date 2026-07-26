// =============================================================================
//  Infinity Football — Engine / Menu / MenuStack (implementation)
// =============================================================================
#include "Engine/Menu/MenuStack.hpp"

namespace inf::menu
{
    void MenuStack::Push(std::shared_ptr<MenuModel> menu)
    {
        if (menu) { stack_.push_back(std::move(menu)); }
    }

    bool MenuStack::Pop()
    {
        if (stack_.empty()) { return false; }
        stack_.pop_back();
        return !stack_.empty();
    }

    MenuModel* MenuStack::Current() const
    {
        return stack_.empty() ? nullptr : stack_.back().get();
    }
} // namespace inf::menu
