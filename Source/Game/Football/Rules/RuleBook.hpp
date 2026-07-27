// =============================================================================
//  Infinity Football — Game / Football / Rules / RuleBook
//  Stateless Laws-of-the-Game helper: given the ball's position and the last
//  team to touch it, it decides whether the ball is out of play and how it
//  should be restarted (throw-in, corner, goal kick). Goals are detected by the
//  Pitch; kickoff/free kick/penalty restarts are produced here and by the
//  discipline system. No hidden state — everything is a function of inputs.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"
#include "Game/Football/Common.hpp"
#include "Game/Football/Terrain/Pitch.hpp"

namespace inf::football
{
    enum class RestartType : u8
    {
        None = 0,
        KickOff,
        ThrowIn,
        CornerKick,
        GoalKick,
        FreeKick,
        Penalty
    };

    const char* ToString(RestartType t) noexcept;

    struct RestartDecision
    {
        RestartType type{RestartType::None};
        Side forSide{Side::Home};  ///< The team awarded the restart.
        math::Vec3 position{};     ///< Where the ball is placed.
    };

    class RuleBook
    {
    public:
        /// Decides the restart when the ball has left the field. Returns a
        /// decision of type None while the ball is still in play. @p lastTouch is
        /// the side of the player who last played the ball.
        [[nodiscard]] static RestartDecision EvaluateOutOfPlay(const Pitch& pitch,
                                                               const math::Vec3& ballPos,
                                                               f32 ballRadius, Side lastTouch);

        /// The ball placed at the centre spot for a kickoff by @p side.
        [[nodiscard]] static RestartDecision KickOffFor(const Pitch& pitch, Side side);
    };
} // namespace inf::football
