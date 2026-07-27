// =============================================================================
//  Infinity Football — Engine / Config / ConfigFile
//  Parser and in-memory model for a single INI-style configuration file:
//
//      # comment (also ';')
//      [section]
//      key = value
//
//  Keys outside any [section] live in the empty ("") section. Whitespace around
//  keys and values is trimmed; values may contain spaces.
// =============================================================================
#pragma once

#include <map>

#include "Engine/Config/ConfigValue.hpp"
#include "Engine/Core/Result.hpp"
#include "Engine/Core/Types.hpp"

namespace inf::config
{
    class ConfigFile
    {
    public:
        /// Parses configuration text (not a path). Never fails: malformed lines
        /// are skipped. Returned for symmetry and future strict-mode use.
        static ConfigFile Parse(const String& text);

        /// Loads and parses a file from disk.
        static Result<ConfigFile> Load(const String& path);

        /// Looks up section/key; returns an empty value if absent.
        [[nodiscard]] ConfigValue Get(const String& section, const String& key) const;

        /// True if the section/key pair exists.
        [[nodiscard]] bool Has(const String& section, const String& key) const;

        /// Sets or overwrites a value (used by tests and future editors).
        void Set(const String& section, const String& key, const String& value);

        [[nodiscard]] usize SectionCount() const noexcept { return sections_.size(); }

    private:
        // section -> (key -> value)
        std::map<String, std::map<String, String>> sections_;
    };
} // namespace inf::config
