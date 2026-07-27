// =============================================================================
//  Infinity Football — Game / Football / Team / Formation
//  A formation is 11 role-tagged slots in normalized pitch coordinates that are
//  mapped onto world positions for a given side. Coordinates are defined for a
//  team attacking +X: nx in [-1, 1] (own goal → opponent goal), nz in [-1, 1]
//  (touchline → touchline). Every slot is editable, so formations are fully
//  configurable, and five standard presets are provided.
// =============================================================================
#pragma once

#include <array>

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Player/Player.hpp"

namespace inf::football
{
    enum class FormationType : u8
    {
        F_4_3_3 = 0,
        F_4_4_2,
        F_3_5_2,
        F_4_2_3_1,
        F_5_3_2
    };

    const char* ToString(FormationType t) noexcept;

    /// One positional slot: a role and a normalized (nx, nz) location.
    struct FormationSlot
    {
        Role role{Role::Midfielder};
        f32 nx{0.0f};
        f32 nz{0.0f};
    };

    class Formation
    {
    public:
        static constexpr usize kSlots = 11;

        Formation() = default;

        /// Builds one of the standard presets.
        static Formation Create(FormationType type);

        [[nodiscard]] FormationType Type() const noexcept { return type_; }

        [[nodiscard]] const FormationSlot& Slot(usize i) const { return slots_[i]; }
        /// Editable slot access — formations are fully configurable.
        void SetSlot(usize i, const FormationSlot& slot) { slots_[i] = slot; }

        /// Maps every slot to a world position on @p pitch for @p side.
        [[nodiscard]] std::array<math::Vec3, kSlots> WorldPositions(const class Pitch& pitch,
                                                                    Side side) const;

    private:
        FormationType type_{FormationType::F_4_3_3};
        std::array<FormationSlot, kSlots> slots_{};
    };
} // namespace inf::football
