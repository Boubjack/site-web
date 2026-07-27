// =============================================================================
//  Infinity Football — Engine / Save / SaveManager (implementation)
// =============================================================================
#include "Engine/Save/SaveManager.hpp"

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <sstream>

#include "Engine/Logging/Logger.hpp"
#include "Engine/Save/Serializer.hpp"

namespace fs = std::filesystem;

namespace inf::save
{
    String SaveManager::PathFor(const String& slot) const
    {
        return (fs::path(directory_) / (slot + ".sav")).string();
    }

    Status SaveManager::Save(const String& slot, const SaveData& data)
    {
        std::error_code ec;
        fs::create_directories(directory_, ec); // harmless if it already exists

        const String finalPath = PathFor(slot);
        const String tempPath = finalPath + ".tmp";

        {
            std::ofstream out(tempPath, std::ios::binary | std::ios::trunc);
            if (!out)
            {
                return Status::Err("cannot open temp save file: " + tempPath);
            }
            out << Serializer::Serialize(data);
            out.flush();
            if (!out)
            {
                return Status::Err("write failed for: " + tempPath);
            }
        }

        // Atomic replace: rename over the existing slot only after a full write.
        fs::rename(tempPath, finalPath, ec);
        if (ec)
        {
            // Fall back to remove+rename for filesystems that reject overwrite.
            fs::remove(finalPath, ec);
            fs::rename(tempPath, finalPath, ec);
            if (ec)
            {
                return Status::Err("atomic rename failed: " + ec.message());
            }
        }

        INF_LOG_INFO("Saved slot '" << slot << "' (" << data.Size() << " keys)");
        return Status::Ok();
    }

    Result<SaveData> SaveManager::Load(const String& slot)
    {
        const String path = PathFor(slot);
        std::ifstream in(path, std::ios::binary);
        if (!in)
        {
            return Result<SaveData>::Err("save slot not found: " + slot);
        }
        std::ostringstream buffer;
        buffer << in.rdbuf();
        auto result = Serializer::Deserialize(buffer.str());
        if (result)
        {
            INF_LOG_INFO("Loaded slot '" << slot << "' (v" << result.Value().Version() << ")");
        }
        return result;
    }

    bool SaveManager::Exists(const String& slot) const
    {
        std::error_code ec;
        return fs::exists(PathFor(slot), ec);
    }

    Status SaveManager::Autosave()
    {
        if (!autosaveProvider_)
        {
            return Status::Err("no autosave provider registered");
        }
        return Save("autosave", autosaveProvider_());
    }
} // namespace inf::save
