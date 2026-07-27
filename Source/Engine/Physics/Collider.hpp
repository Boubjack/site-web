// =============================================================================
//  Infinity Football — Engine / Physics / Collider
//  Static collision primitives the world tests dynamic bodies against. Kept
//  deliberately small and generic (ground plane + vertical post segment); the
//  game layer maps football structures (pitch ground, goal posts) onto these.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"
#include "Engine/Math/Math.hpp"

namespace inf::physics
{
    /// An infinite horizontal ground plane at a given height (Y). Bodies bounce
    /// off it using their restitution and lose tangential speed to friction.
    struct GroundPlane
    {
        f32 height{0.0f}; ///< Y coordinate of the ground surface.
    };

    /// A vertical cylindrical post between two heights at an X–Z location, with
    /// a radius — used for goal posts and crossbar approximation. The crossbar
    /// is modelled as a post laid horizontally by swapping the swept axis.
    struct VerticalPost
    {
        math::Vec3 base{};   ///< Bottom point (X–Z position, Y = base height).
        f32 height{2.44f};   ///< Length along the swept axis (goal height by default).
        f32 radius{0.06f};   ///< Post thickness radius.
        bool horizontal{false}; ///< If true the post is swept along X (crossbar).
    };

    /// An oriented, one-sided plane a body collides with when it reaches the
    /// plane from the normal's positive side. Used by the game layer for goal
    /// nets (low restitution → the ball is absorbed) and outer boundaries.
    struct Plane
    {
        math::Vec3 point{};              ///< A point on the plane.
        math::Vec3 normal{0.0f, 0.0f, 1.0f}; ///< Unit outward normal (facing incoming bodies).
        f32 restitution{0.1f};           ///< Bounciness; nets use a small value.
        f32 halfWidth{0.0f};             ///< 0 = infinite; otherwise the plane only acts within
                                         ///< this half-extent of `point` on the axis orthogonal
                                         ///< to the normal and to Y (keeps a net goal-width).
    };
} // namespace inf::physics
