// =============================================================================
//  Infinity Football — Game / Football / Player
//  A footballer: stable identity, physical attributes, skill ratings and a
//  discrete state. In a match the player is backed by a PhysicsWorld body (an
//  immovable collider this mission, since there is no movement AI yet), so the
//  ball and other players collide with it. Player itself is plain data and is
//  fully testable without a physics world.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Engine/Physics/RigidBody.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Player/PlayerState.hpp"

namespace inf::football
{
    enum class Role : u8
    {
        Goalkeeper = 0,
        Defender,
        Midfielder,
        Forward
    };

    enum class FootStrong : u8
    {
        Left = 0,
        Right,
        Both
    };

    const char* ToString(Role r) noexcept;
    const char* ToString(FootStrong f) noexcept;

    /// Physical size and skill ratings. Ratings are 0–100.
    struct PlayerAttributes
    {
        f32 heightCm{180.0f};
        f32 weightKg{75.0f};

        u8 pace{50};
        u8 acceleration{50};
        u8 balance{50};
        u8 stamina{50};
        u8 power{50};
        u8 accuracy{50};
        u8 control{50};
        u8 dribble{50};
        u8 passing{50};
        u8 shooting{50};
        u8 heading{50};
    };

    class Player
    {
    public:
        Player(u32 id, String name, u8 number, Role role, FootStrong foot, Side side,
               PlayerAttributes attributes = {})
            : id_(id), name_(std::move(name)), number_(number), role_(role), foot_(foot),
              side_(side), attributes_(attributes)
        {
        }

        // --- Identity -------------------------------------------------------
        [[nodiscard]] u32 Id() const noexcept { return id_; }
        [[nodiscard]] const String& Name() const noexcept { return name_; }
        [[nodiscard]] u8 Number() const noexcept { return number_; }
        [[nodiscard]] Role PlayingRole() const noexcept { return role_; }
        [[nodiscard]] FootStrong StrongFoot() const noexcept { return foot_; }
        [[nodiscard]] Side TeamSide() const noexcept { return side_; }

        // --- Attributes -----------------------------------------------------
        [[nodiscard]] const PlayerAttributes& Attributes() const noexcept { return attributes_; }
        [[nodiscard]] PlayerAttributes& Attributes() noexcept { return attributes_; }

        // --- State (states only; no animation) ------------------------------
        [[nodiscard]] PlayerState State() const noexcept { return state_; }
        void SetState(PlayerState s) noexcept { state_ = s; }

        // --- Field placement ------------------------------------------------
        [[nodiscard]] const math::Vec3& Position() const noexcept { return position_; }
        void SetPosition(const math::Vec3& p) noexcept { position_ = p; }

        /// Body radius used when the player is added to the PhysicsWorld.
        [[nodiscard]] f32 BodyRadius() const noexcept { return 0.4f; }

        // --- Physics link (set by MatchEngine) ------------------------------
        [[nodiscard]] physics::BodyId BodyId() const noexcept { return bodyId_; }
        void SetBodyId(physics::BodyId id) noexcept { bodyId_ = id; }

    private:
        u32 id_;
        String name_;
        u8 number_;
        Role role_;
        FootStrong foot_;
        Side side_;
        PlayerAttributes attributes_;

        PlayerState state_{PlayerState::Idle};
        math::Vec3 position_{};
        physics::BodyId bodyId_{0};
    };
} // namespace inf::football
