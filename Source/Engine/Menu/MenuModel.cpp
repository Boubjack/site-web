// =============================================================================
//  Infinity Football — Engine / Menu / MenuModel (implementation)
// =============================================================================
#include "Engine/Menu/MenuModel.hpp"

namespace inf::menu
{
    MenuItem& MenuModel::AddItem(MenuItem item)
    {
        items_.push_back(std::move(item));
        return items_.back();
    }

    usize MenuModel::NextEnabled(usize from, int direction) const
    {
        if (items_.empty()) { return 0; }
        const usize n = items_.size();
        usize idx = from;
        for (usize step = 0; step < n; ++step)
        {
            idx = (idx + static_cast<usize>(direction < 0 ? n - 1 : 1)) % n;
            if (items_[idx].enabled) { return idx; }
        }
        return from; // no other enabled item
    }

    void MenuModel::MoveUp()
    {
        selected_ = NextEnabled(selected_, -1);
    }

    void MenuModel::MoveDown()
    {
        selected_ = NextEnabled(selected_, +1);
    }

    void MenuModel::Activate()
    {
        if (selected_ >= items_.size()) { return; }
        const MenuItem& item = items_[selected_];
        if (item.enabled && item.onActivate) { item.onActivate(); }
    }

    void MenuModel::SetSelectedIndex(usize index)
    {
        if (index < items_.size()) { selected_ = index; }
    }

    const MenuItem* MenuModel::Selected() const
    {
        return selected_ < items_.size() ? &items_[selected_] : nullptr;
    }
} // namespace inf::menu
