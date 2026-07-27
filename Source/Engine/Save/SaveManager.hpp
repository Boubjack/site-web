// =============================================================================
//  Infinity Football — Engine / Save / SaveManager
//  Persists SaveData to named slots under a save directory. Writes go to a
//  temporary file that is atomically renamed into place, so an interrupted
//  write can never corrupt an existing save ("aucune perte de données").
//
//  An autosave hook lets game systems supply the current SaveData on demand
//  without the manager knowing anything about gameplay.
// =============================================================================
#pragma once

#include <functional>

#include "Engine/Core/Result.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Save/SaveData.hpp"

namespace inf::save
{
    class SaveManager
    {
    public:
        /// @p directory is where slot files live (e.g. "Saves"). It is created
        /// on first write if missing.
        explicit SaveManager(String directory) : directory_(std::move(directory)) {}

        /// Writes @p data to slot @p slot atomically. Returns an error status on
        /// I/O failure without throwing.
        Status Save(const String& slot, const SaveData& data);

        /// Loads slot @p slot. Fails if the file is missing or corrupt.
        Result<SaveData> Load(const String& slot);

        /// True if a file for @p slot exists on disk.
        [[nodiscard]] bool Exists(const String& slot) const;

        /// Registers a callback that produces the SaveData to autosave.
        void SetAutosaveProvider(std::function<SaveData()> provider)
        {
            autosaveProvider_ = std::move(provider);
        }

        /// Writes the autosave slot using the registered provider. No-op (with
        /// an error status) if no provider was set.
        Status Autosave();

        [[nodiscard]] const String& Directory() const noexcept { return directory_; }

    private:
        [[nodiscard]] String PathFor(const String& slot) const;

        String directory_;
        std::function<SaveData()> autosaveProvider_{};
    };
} // namespace inf::save
