// =============================================================================
//  Infinity Football — Engine / Menu / MenuStack
//  A stack of menus modelling navigation: opening a submenu pushes it, going
//  back pops it. The top menu is the active one. Ownership is shared so a menu
//  can be prebuilt once and reused.
// =============================================================================
#pragma once

#include <memory>
#include <vector>

#include "Engine/Core/Types.hpp"
#include "Engine/Menu/MenuModel.hpp"

namespace inf::menu
{
    class MenuStack
    {
    public:
        /// Pushes @p menu and makes it active.
        void Push(std::shared_ptr<MenuModel> menu);

        /// Pops the active menu. Returns false if the stack is (or becomes)
        /// empty — useful to detect "back closes the menu system".
        bool Pop();

        /// The active menu, or nullptr if the stack is empty.
        [[nodiscard]] MenuModel* Current() const;

        [[nodiscard]] bool Empty() const noexcept { return stack_.empty(); }
        [[nodiscard]] usize Depth() const noexcept { return stack_.size(); }
        void Clear() { stack_.clear(); }

    private:
        std::vector<std::shared_ptr<MenuModel>> stack_;
    };
} // namespace inf::menu
