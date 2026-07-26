// Unit tests — Config subsystem.
#include "Engine/Config/ConfigFile.hpp"
#include "Engine/Config/ConfigManager.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::config;

INF_TEST(Config_ParsesSectionsAndTypes)
{
    const inf::String text =
        "# comment line\n"
        "[video]\n"
        "width = 1280\n"
        "height = 720\n"
        "vsync = true\n"
        "scale = 1.5\n"
        "; another comment\n"
        "[audio]\n"
        "master = 0.8\n";

    const ConfigFile cfg = ConfigFile::Parse(text);
    REQUIRE_EQ(cfg.SectionCount(), static_cast<inf::usize>(2));
    REQUIRE_EQ(cfg.Get("video", "width").AsInt(), static_cast<inf::i64>(1280));
    REQUIRE_EQ(cfg.Get("video", "height").AsInt(), static_cast<inf::i64>(720));
    REQUIRE(cfg.Get("video", "vsync").AsBool());
    REQUIRE(cfg.Get("video", "scale").AsFloat() > 1.49 && cfg.Get("video", "scale").AsFloat() < 1.51);
    REQUIRE(cfg.Get("audio", "master").AsFloat() > 0.79);
}

INF_TEST(Config_MissingKeyReturnsFallback)
{
    const ConfigFile cfg = ConfigFile::Parse("[x]\na = 1\n");
    REQUIRE_EQ(cfg.Get("x", "missing").AsInt(42), static_cast<inf::i64>(42));
    REQUIRE(!cfg.Has("x", "missing"));
    REQUIRE(cfg.Has("x", "a"));
}

INF_TEST(Config_ManagerRegistersAndQueries)
{
    ConfigManager mgr;
    mgr.Register("engine", ConfigFile::Parse("[video]\nfov = 55\n"));
    REQUIRE(mgr.Has("engine"));
    REQUIRE_EQ(mgr.Get("engine", "video", "fov").AsInt(), static_cast<inf::i64>(55));
    // Unknown config still returns a safe empty value.
    REQUIRE_EQ(mgr.Get("nope", "a", "b").AsInt(7), static_cast<inf::i64>(7));
}
