// =============================================================================
//  Infinity Football — Engine / Save / SaveData
//  A versioned key/value container that game systems fill in before a save and
//  read back after a load. Values are stored as strings with typed accessors,
//  mirroring ConfigValue but writable and serializable.
// =============================================================================
#pragma once

#include <map>

#include "Engine/Core/Types.hpp"

namespace inf::save
{
    class SaveData
    {
    public:
        /// Schema version stamped into every save file. Bump when the meaning
        /// of stored keys changes so loaders can migrate old saves.
        static constexpr u32 kCurrentVersion = 1;

        SaveData() = default;

        void SetString(const String& key, const String& value) { values_[key] = value; }
        void SetInt(const String& key, i64 value);
        void SetFloat(const String& key, f64 value);
        void SetBool(const String& key, bool value);

        [[nodiscard]] String GetString(const String& key, const String& fallback = {}) const;
        [[nodiscard]] i64 GetInt(const String& key, i64 fallback = 0) const;
        [[nodiscard]] f64 GetFloat(const String& key, f64 fallback = 0.0) const;
        [[nodiscard]] bool GetBool(const String& key, bool fallback = false) const;

        [[nodiscard]] bool Has(const String& key) const { return values_.count(key) != 0; }
        [[nodiscard]] usize Size() const noexcept { return values_.size(); }

        [[nodiscard]] u32 Version() const noexcept { return version_; }
        void SetVersion(u32 v) noexcept { version_ = v; }

        [[nodiscard]] const std::map<String, String>& Values() const noexcept { return values_; }

    private:
        std::map<String, String> values_;
        u32 version_{kCurrentVersion};
    };
} // namespace inf::save
