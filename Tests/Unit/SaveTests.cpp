// Unit tests — Save subsystem (serialization + atomic slot I/O).
#include <filesystem>

#include "Engine/Save/SaveData.hpp"
#include "Engine/Save/SaveManager.hpp"
#include "Engine/Save/Serializer.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::save;

INF_TEST(Save_SerializeRoundTrip)
{
    SaveData data;
    data.SetString("name", "Équipe = A\nB"); // contains '=' and newline
    data.SetInt("season", 3);
    data.SetBool("firstRun", true);

    const inf::String text = Serializer::Serialize(data);
    auto restored = Serializer::Deserialize(text);
    REQUIRE(restored.IsOk());
    REQUIRE_EQ(restored.Value().GetString("name"), inf::String("Équipe = A\nB"));
    REQUIRE_EQ(restored.Value().GetInt("season"), static_cast<inf::i64>(3));
    REQUIRE(restored.Value().GetBool("firstRun"));
    REQUIRE_EQ(restored.Value().Version(), SaveData::kCurrentVersion);
}

INF_TEST(Save_RejectsCorruptData)
{
    auto bad = Serializer::Deserialize("not a valid header\nkey=value\n");
    REQUIRE(!bad.IsOk());
}

INF_TEST(Save_ManagerAtomicSaveAndLoad)
{
    const std::filesystem::path dir =
        std::filesystem::temp_directory_path() / "inf_save_test";
    std::filesystem::remove_all(dir);

    SaveManager mgr(dir.string());
    REQUIRE(!mgr.Exists("slot0"));

    SaveData data;
    data.SetInt("gold", 100);
    REQUIRE(mgr.Save("slot0", data).IsOk());
    REQUIRE(mgr.Exists("slot0"));
    // No leftover temp file after an atomic write.
    REQUIRE(!std::filesystem::exists(dir / "slot0.sav.tmp"));

    auto loaded = mgr.Load("slot0");
    REQUIRE(loaded.IsOk());
    REQUIRE_EQ(loaded.Value().GetInt("gold"), static_cast<inf::i64>(100));

    std::filesystem::remove_all(dir);
}

INF_TEST(Save_AutosaveUsesProvider)
{
    const std::filesystem::path dir =
        std::filesystem::temp_directory_path() / "inf_autosave_test";
    std::filesystem::remove_all(dir);

    SaveManager mgr(dir.string());
    REQUIRE(!mgr.Autosave().IsOk()); // no provider yet

    mgr.SetAutosaveProvider([] {
        SaveData d;
        d.SetInt("tick", 7);
        return d;
    });
    REQUIRE(mgr.Autosave().IsOk());
    REQUIRE(mgr.Exists("autosave"));

    std::filesystem::remove_all(dir);
}
