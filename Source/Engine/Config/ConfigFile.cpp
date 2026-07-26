// =============================================================================
//  Infinity Football — Engine / Config / ConfigFile (implementation)
// =============================================================================
#include "Engine/Config/ConfigFile.hpp"

#include <fstream>
#include <sstream>

namespace inf::config
{
    namespace
    {
        String Trim(const String& s)
        {
            const auto begin = s.find_first_not_of(" \t\r\n");
            if (begin == String::npos) { return {}; }
            const auto end = s.find_last_not_of(" \t\r\n");
            return s.substr(begin, end - begin + 1);
        }
    } // namespace

    ConfigFile ConfigFile::Parse(const String& text)
    {
        ConfigFile cfg;
        std::istringstream stream(text);
        String line;
        String currentSection; // empty section by default

        while (std::getline(stream, line))
        {
            const String trimmed = Trim(line);
            if (trimmed.empty() || trimmed[0] == '#' || trimmed[0] == ';')
            {
                continue; // blank or comment
            }

            if (trimmed.front() == '[' && trimmed.back() == ']')
            {
                currentSection = Trim(trimmed.substr(1, trimmed.size() - 2));
                continue;
            }

            const auto eq = trimmed.find('=');
            if (eq == String::npos)
            {
                continue; // malformed line, skip
            }

            const String key = Trim(trimmed.substr(0, eq));
            const String value = Trim(trimmed.substr(eq + 1));
            if (!key.empty())
            {
                cfg.sections_[currentSection][key] = value;
            }
        }
        return cfg;
    }

    Result<ConfigFile> ConfigFile::Load(const String& path)
    {
        std::ifstream file(path, std::ios::binary);
        if (!file)
        {
            return Result<ConfigFile>::Err("cannot open config file: " + path);
        }
        std::ostringstream buffer;
        buffer << file.rdbuf();
        return Result<ConfigFile>::Ok(Parse(buffer.str()));
    }

    ConfigValue ConfigFile::Get(const String& section, const String& key) const
    {
        const auto sit = sections_.find(section);
        if (sit == sections_.end()) { return ConfigValue{}; }
        const auto kit = sit->second.find(key);
        if (kit == sit->second.end()) { return ConfigValue{}; }
        return ConfigValue{kit->second};
    }

    bool ConfigFile::Has(const String& section, const String& key) const
    {
        const auto sit = sections_.find(section);
        if (sit == sections_.end()) { return false; }
        return sit->second.find(key) != sit->second.end();
    }

    void ConfigFile::Set(const String& section, const String& key, const String& value)
    {
        sections_[section][key] = value;
    }
} // namespace inf::config
