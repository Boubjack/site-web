// =============================================================================
//  Infinity Football — Engine / Save / SaveData (implementation)
// =============================================================================
#include "Engine/Save/SaveData.hpp"

#include <cstdlib>
#include <string>

namespace inf::save
{
    void SaveData::SetInt(const String& key, i64 value)
    {
        values_[key] = std::to_string(value);
    }

    void SaveData::SetFloat(const String& key, f64 value)
    {
        values_[key] = std::to_string(value);
    }

    void SaveData::SetBool(const String& key, bool value)
    {
        values_[key] = value ? "true" : "false";
    }

    String SaveData::GetString(const String& key, const String& fallback) const
    {
        const auto it = values_.find(key);
        return it != values_.end() ? it->second : fallback;
    }

    i64 SaveData::GetInt(const String& key, i64 fallback) const
    {
        const auto it = values_.find(key);
        if (it == values_.end()) { return fallback; }
        char* end = nullptr;
        const long long v = std::strtoll(it->second.c_str(), &end, 10);
        return end == it->second.c_str() ? fallback : static_cast<i64>(v);
    }

    f64 SaveData::GetFloat(const String& key, f64 fallback) const
    {
        const auto it = values_.find(key);
        if (it == values_.end()) { return fallback; }
        char* end = nullptr;
        const double v = std::strtod(it->second.c_str(), &end);
        return end == it->second.c_str() ? fallback : static_cast<f64>(v);
    }

    bool SaveData::GetBool(const String& key, bool fallback) const
    {
        const auto it = values_.find(key);
        if (it == values_.end()) { return fallback; }
        return it->second == "true" || it->second == "1";
    }
} // namespace inf::save
