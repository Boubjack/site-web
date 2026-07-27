// =============================================================================
//  Infinity Football — Game / Football / Rules / RuleBook (implementation)
// =============================================================================
#include "Game/Football/Rules/RuleBook.hpp"

namespace inf::football
{
    const char* ToString(RestartType t) noexcept
    {
        switch (t)
        {
            case RestartType::None:       return "None";
            case RestartType::KickOff:    return "KickOff";
            case RestartType::ThrowIn:    return "ThrowIn";
            case RestartType::CornerKick: return "CornerKick";
            case RestartType::GoalKick:   return "GoalKick";
            case RestartType::FreeKick:   return "FreeKick";
            case RestartType::Penalty:    return "Penalty";
        }
        return "Unknown";
    }

    RestartDecision RuleBook::KickOffFor(const Pitch& pitch, Side side)
    {
        return {RestartType::KickOff, side, pitch.Centre()};
    }

    RestartDecision RuleBook::EvaluateOutOfPlay(const Pitch& pitch, const math::Vec3& ballPos,
                                                f32 ballRadius, Side lastTouch)
    {
        const f32 hl = pitch.HalfLength();
        const f32 hw = pitch.HalfWidth();

        // Over a touchline → throw-in to the team that did not touch it last.
        if (ballPos.z > hw || ballPos.z < -hw)
        {
            const f32 z = ballPos.z > 0.0f ? hw : -hw;
            const f32 x = math::Clamp(ballPos.x, -hl, hl);
            return {RestartType::ThrowIn, Opponent(lastTouch), {x, 0.0f, z}};
        }

        // Over a goal line (and not a goal, which the caller checks first).
        if (ballPos.x > hl || ballPos.x < -hl)
        {
            const Side goalSide = ballPos.x < 0.0f ? Side::Home : Side::Away; // whose goal line
            const f32 goalX = pitch.GoalLineX(goalSide);
            const f32 inward = goalSide == Side::Home ? 1.0f : -1.0f;

            if (lastTouch == goalSide)
            {
                // Defending team put it out → corner to the attackers.
                const f32 z = ballPos.z >= 0.0f ? hw : -hw;
                return {RestartType::CornerKick, Opponent(goalSide), {goalX, 0.0f, z}};
            }
            // Attacking team put it out → goal kick to the defenders.
            const f32 kickX = goalX + inward * pitch.Dimensions().goalAreaLength;
            const f32 z = ballPos.z >= 0.0f ? pitch.Dimensions().goalAreaWidth * 0.5f
                                            : -pitch.Dimensions().goalAreaWidth * 0.5f;
            return {RestartType::GoalKick, goalSide, {kickX, 0.0f, z}};
        }

        (void)ballRadius; // crossing is judged on the ball centre in this model
        return {RestartType::None, lastTouch, ballPos};
    }
} // namespace inf::football
