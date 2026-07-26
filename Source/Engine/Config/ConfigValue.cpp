// =============================================================================
//  Infinity Football — Engine / Config / ConfigValue (implementation)
// =============================================================================
#include "Engine/Config/ConfigValue.hpp"

#include <algorithm>
#include <cctype>
#include <cstdlib>

namespace inf::config
{
    i64 ConfigValue::AsInt(i64 fallback) const noexcept
    {
        if (raw_.empty()) { return fallback; }
        char* end = nullptr;
        const long long v = std::strtoll(raw_.c_str(), &end, 10);
        return end == raw_.c_str() ? fallback : static_cast<i64>(v);
    }

    f64 ConfigValue::AsFloat(f64 fallback) const noexcept
    {
        if (raw_.empty()) { return fallback; }
        char* end = nullptr;
        const double v = std::strtod(raw_.c_str(), &end);
        return end == raw_.c_str() ? fallback : static_cast<f64>(v);
    }

    bool ConfigValue::AsBool(bool fallback) const noexcept
    {
        if (raw_.empty()) { return fallback; }
        String lower;
        lower.reserve(raw_.size());
        for (char c : raw_)
        {
            lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
        }
        if (lower == "true" || lower == "1" || lower == "yes" || lower == "on") { return true; }
        if (lower == "false" || lower == "0" || lower == "no" || lower == "off") { return false; }
        return fallback;
    }
} // namespace inf::config
