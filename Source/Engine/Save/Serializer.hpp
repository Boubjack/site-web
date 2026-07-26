// =============================================================================
//  Infinity Football — Engine / Save / Serializer
//  Text (de)serialization of SaveData. The on-disk format is deliberately
//  simple and human-inspectable:
//
//      INFSAVE v<version>
//      <key>=<value>
//      ...
//
//  Keys and values are escaped so newlines and '=' inside values round-trip.
// =============================================================================
#pragma once

#include "Engine/Core/Result.hpp"
#include "Engine/Core/Types.hpp"
#include "Engine/Save/SaveData.hpp"

namespace inf::save
{
    class Serializer
    {
    public:
        /// Serializes @p data to the textual save format.
        static String Serialize(const SaveData& data);

        /// Parses save text back into a SaveData. Fails on a missing/invalid
        /// header so a corrupt or foreign file is never silently accepted.
        static Result<SaveData> Deserialize(const String& text);
    };
} // namespace inf::save
