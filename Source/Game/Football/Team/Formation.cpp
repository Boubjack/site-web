// =============================================================================
//  Infinity Football — Game / Football / Team / Formation (implementation)
// =============================================================================
#include "Game/Football/Team/Formation.hpp"

#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    const char* ToString(FormationType t) noexcept
    {
        switch (t)
        {
            case FormationType::F_4_3_3:   return "4-3-3";
            case FormationType::F_4_4_2:   return "4-4-2";
            case FormationType::F_3_5_2:   return "3-5-2";
            case FormationType::F_4_2_3_1: return "4-2-3-1";
            case FormationType::F_5_3_2:   return "5-3-2";
        }
        return "Unknown";
    }

    namespace
    {
        using S = FormationSlot;
        constexpr Role GK = Role::Goalkeeper;
        constexpr Role DF = Role::Defender;
        constexpr Role MF = Role::Midfielder;
        constexpr Role FW = Role::Forward;

        // Each preset lists the goalkeeper first, then defence, midfield, attack.
        std::array<FormationSlot, Formation::kSlots> Preset(FormationType type)
        {
            switch (type)
            {
                case FormationType::F_4_3_3:
                    return {{{GK, -0.95f, 0.0f},
                             {DF, -0.6f, -0.6f}, {DF, -0.6f, -0.2f}, {DF, -0.6f, 0.2f}, {DF, -0.6f, 0.6f},
                             {MF, -0.1f, -0.5f}, {MF, -0.1f, 0.0f}, {MF, -0.1f, 0.5f},
                             {FW, 0.5f, -0.6f}, {FW, 0.5f, 0.0f}, {FW, 0.5f, 0.6f}}};
                case FormationType::F_4_4_2:
                    return {{{GK, -0.95f, 0.0f},
                             {DF, -0.6f, -0.6f}, {DF, -0.6f, -0.2f}, {DF, -0.6f, 0.2f}, {DF, -0.6f, 0.6f},
                             {MF, -0.05f, -0.6f}, {MF, -0.05f, -0.2f}, {MF, -0.05f, 0.2f}, {MF, -0.05f, 0.6f},
                             {FW, 0.5f, -0.25f}, {FW, 0.5f, 0.25f}}};
                case FormationType::F_3_5_2:
                    return {{{GK, -0.95f, 0.0f},
                             {DF, -0.6f, -0.5f}, {DF, -0.6f, 0.0f}, {DF, -0.6f, 0.5f},
                             {MF, -0.05f, -0.7f}, {MF, -0.05f, -0.35f}, {MF, -0.05f, 0.0f},
                             {MF, -0.05f, 0.35f}, {MF, -0.05f, 0.7f},
                             {FW, 0.5f, -0.25f}, {FW, 0.5f, 0.25f}}};
                case FormationType::F_4_2_3_1:
                    return {{{GK, -0.95f, 0.0f},
                             {DF, -0.6f, -0.6f}, {DF, -0.6f, -0.2f}, {DF, -0.6f, 0.2f}, {DF, -0.6f, 0.6f},
                             {MF, -0.25f, -0.25f}, {MF, -0.25f, 0.25f},
                             {MF, 0.15f, -0.5f}, {MF, 0.15f, 0.0f}, {MF, 0.15f, 0.5f},
                             {FW, 0.55f, 0.0f}}};
                case FormationType::F_5_3_2:
                    return {{{GK, -0.95f, 0.0f},
                             {DF, -0.6f, -0.7f}, {DF, -0.6f, -0.35f}, {DF, -0.6f, 0.0f},
                             {DF, -0.6f, 0.35f}, {DF, -0.6f, 0.7f},
                             {MF, -0.05f, -0.5f}, {MF, -0.05f, 0.0f}, {MF, -0.05f, 0.5f},
                             {FW, 0.5f, -0.25f}, {FW, 0.5f, 0.25f}}};
            }
            return {};
        }
    } // namespace

    Formation Formation::Create(FormationType type)
    {
        Formation f;
        f.type_ = type;
        f.slots_ = Preset(type);
        return f;
    }

    std::array<math::Vec3, Formation::kSlots> Formation::WorldPositions(const Pitch& pitch,
                                                                        Side side) const
    {
        const f32 hl = pitch.HalfLength();
        const f32 hw = pitch.HalfWidth();
        const f32 dir = side == Side::Home ? 1.0f : -1.0f; // Away is rotated 180°.

        std::array<math::Vec3, kSlots> out{};
        for (usize i = 0; i < kSlots; ++i)
        {
            out[i] = {slots_[i].nx * hl * dir, 0.0f, slots_[i].nz * hw * dir};
        }
        return out;
    }
} // namespace inf::football
