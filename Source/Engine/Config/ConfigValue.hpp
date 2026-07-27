// =============================================================================
//  Infinity Football — Engine / Config / ConfigValue
//  A configuration value is stored as text and converted on demand. Keeping a
//  single storage type keeps the parser trivial while typed accessors give
//  callers convenience and a default fallback.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::config
{
    class ConfigValue
    {
    public:
        ConfigValue() = default;
        explicit ConfigValue(String raw) : raw_(std::move(raw)) {}

        [[nodiscard]] const String& AsString() const noexcept { return raw_; }

        [[nodiscard]] i64 AsInt(i64 fallback = 0) const noexcept;
        [[nodiscard]] f64 AsFloat(f64 fallback = 0.0) const noexcept;
        [[nodiscard]] bool AsBool(bool fallback = false) const noexcept;

        [[nodiscard]] bool Empty() const noexcept { return raw_.empty(); }

    private:
        String raw_{};
    };
} // namespace inf::config
