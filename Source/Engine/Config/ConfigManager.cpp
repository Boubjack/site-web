// =============================================================================
//  Infinity Football — Engine / Config / ConfigManager (implementation)
// =============================================================================
#include "Engine/Config/ConfigManager.hpp"

#include <utility>

#include "Engine/Logging/Logger.hpp"

namespace inf::config
{
    Status ConfigManager::LoadFile(const String& name, const String& path)
    {
        auto result = ConfigFile::Load(path);
        if (!result)
        {
            INF_LOG_WARN("Config '" << name << "' not loaded (" << result.Error()
                                    << "); using defaults");
            return Status::Err(result.Error());
        }
        files_[name] = std::move(result.Value());
        INF_LOG_INFO("Config '" << name << "' loaded from " << path);
        return Status::Ok();
    }

    void ConfigManager::Register(const String& name, ConfigFile file)
    {
        files_[name] = std::move(file);
    }

    bool ConfigManager::Has(const String& name) const
    {
        return files_.find(name) != files_.end();
    }

    const ConfigFile& ConfigManager::File(const String& name) const
    {
        const auto it = files_.find(name);
        return it != files_.end() ? it->second : empty_;
    }

    ConfigValue ConfigManager::Get(const String& name, const String& section,
                                   const String& key) const
    {
        return File(name).Get(section, key);
    }
} // namespace inf::config
