// =============================================================================
//  Infinity Football — Engine / Menu / MenuModel
//  UI-agnostic menu state: an ordered list of selectable items with a moving
//  cursor. This is the model only — no rendering, no input polling. A renderer
//  draws it; the InputSystem drives navigation by calling MoveUp/Down/Activate.
// =============================================================================
#pragma once

#include <functional>
#include <vector>

#include "Engine/Core/Types.hpp"

namespace inf::menu
{
    /// A single menu entry. @p onActivate is invoked when the item is chosen.
    struct MenuItem
    {
        String id;
        String label;
        bool enabled{true};
        std::function<void()> onActivate{};
    };

    class MenuModel
    {
    public:
        explicit MenuModel(String title = {}) : title_(std::move(title)) {}

        MenuItem& AddItem(MenuItem item);

        /// Moves the cursor to the previous/next enabled item (wraps around).
        void MoveUp();
        void MoveDown();

        /// Invokes the selected item's callback if it is enabled.
        void Activate();

        [[nodiscard]] usize SelectedIndex() const noexcept { return selected_; }
        void SetSelectedIndex(usize index);

        [[nodiscard]] const MenuItem* Selected() const;
        [[nodiscard]] const std::vector<MenuItem>& Items() const noexcept { return items_; }
        [[nodiscard]] const String& Title() const noexcept { return title_; }
        [[nodiscard]] usize Size() const noexcept { return items_.size(); }

    private:
        [[nodiscard]] usize NextEnabled(usize from, int direction) const;

        String title_;
        std::vector<MenuItem> items_;
        usize selected_{0};
    };
} // namespace inf::menu
