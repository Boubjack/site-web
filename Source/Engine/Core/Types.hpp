// =============================================================================
//  Infinity Football — Engine / Core / Types
//  Project-wide fixed-width type aliases. Depends only on the standard library.
// =============================================================================
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace inf
{
    using u8  = std::uint8_t;
    using u16 = std::uint16_t;
    using u32 = std::uint32_t;
    using u64 = std::uint64_t;

    using i8  = std::int8_t;
    using i16 = std::int16_t;
    using i32 = std::int32_t;
    using i64 = std::int64_t;

    using f32 = float;
    using f64 = double;

    using usize = std::size_t;

    using String = std::string;
} // namespace inf

// The math layer references these aliases via inf::f32 etc.
namespace inf::math
{
    using inf::f32;
    using inf::f64;
    using inf::u32;
    using inf::usize;
} // namespace inf::math
