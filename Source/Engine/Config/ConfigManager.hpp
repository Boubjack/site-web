// =============================================================================
//  Infinity Football — Engine / Config / ConfigManager
//  Owns the set of configuration files loaded at startup (engine, input,
//  logging, ...) keyed by a logical name, and exposes a single query surface.
// =============================================================================
#pragma once

#include <map>

#include "Engine/Config/ConfigFile.hpp"
#include "Engine/Core/Result.hpp"
#include "Engine/Core/Types.hpp"

namespace inf::config
{
    class ConfigManager
    {
    public:
        /// Loads @p path and registers it under @p name (e.g. "engine").
        /// A missing file is reported but not fatal, so the engine can boot on
        /// built-in defaults.
        Status LoadFile(const String& name, const String& path);

        /// Registers an already-parsed file (used by tests).
        void Register(const String& name, ConfigFile file);

        /// True if a config named @p name has been loaded.
        [[nodiscard]] bool Has(const String& name) const;

        /// Returns the named config, or an empty config if not loaded, so
        /// callers can always chain .Get(...) safely.
        [[nodiscard]] const ConfigFile& File(const String& name) const;

        /// Convenience: query section/key from a named file directly.
        [[nodiscard]] ConfigValue Get(const String& name, const String& section,
                                      const String& key) const;

        [[nodiscard]] usize Count() const noexcept { return files_.size(); }

    private:
        std::map<String, ConfigFile> files_;
        ConfigFile empty_{}; // returned by reference for unknown names
    };
} // namespace inf::config
