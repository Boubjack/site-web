// =============================================================================
//  Infinity Football — Sandbox
//  Headless boot program that wires up the engine and exercises every
//  foundation subsystem once, proving they integrate cleanly. It contains NO
//  gameplay — it is a smoke test / living example of the engine API.
// =============================================================================
#include <memory>

#include "Engine/Core/Engine.hpp"
#include "Engine/Input/NullInputBackend.hpp"
#include "Engine/Logging/Logger.hpp"
#include "Engine/Menu/MenuModel.hpp"
#include "Engine/Resources/Resource.hpp"
#include "Engine/Save/SaveData.hpp"

namespace
{
    // A trivial concrete resource type, only to demonstrate the loader/cache.
    class TextResource final : public inf::resources::Resource
    {
    public:
        TextResource(inf::resources::ResourceId id, inf::String body)
            : Resource(std::move(id)), body_(std::move(body))
        {
        }
        [[nodiscard]] const inf::String& Body() const noexcept { return body_; }

    private:
        inf::String body_;
    };
} // namespace

int main()
{
    using namespace inf;

    core::Engine engine;

    // Inject a Null input backend we keep a handle to, so we can simulate input.
    auto inputBackend = std::make_unique<input::NullInputBackend>();
    input::NullInputBackend* rawInput = inputBackend.get();
    engine.Input().SetBackend(std::move(inputBackend));

    core::EngineConfig cfg; // uses Config/, Saves/, Logs/ defaults
    if (!engine.Initialize(cfg))
    {
        INF_LOG_CRIT("Sandbox: engine failed to initialize");
        return 1;
    }

    // --- Events ------------------------------------------------------------
    struct FrameTick { u64 frame; };
    auto sub = engine.Events().Subscribe<FrameTick>(
        [](const FrameTick& e) { INF_LOG_DEBUG("event FrameTick #" << e.frame); });

    // --- Resources ---------------------------------------------------------
    engine.Resources().RegisterLoader<TextResource>(
        [](const resources::ResourceId& id) {
            return std::make_shared<TextResource>(id, "content-of:" + id);
        });
    auto readme = engine.Resources().Load<TextResource>("Assets/Data/readme.txt");
    INF_LOG_INFO("Resource loaded: " << (readme ? readme->Body() : "<null>")
                                     << " (cached=" << engine.Resources().CachedCount() << ")");

    // --- Menu --------------------------------------------------------------
    auto mainMenu = std::make_shared<menu::MenuModel>("Main Menu");
    mainMenu->AddItem({"play", "Play", true, [] { INF_LOG_INFO("menu: Play chosen"); }});
    mainMenu->AddItem({"career", "Career", true, [] { INF_LOG_INFO("menu: Career chosen"); }});
    mainMenu->AddItem({"quit", "Quit", true, [] { INF_LOG_INFO("menu: Quit chosen"); }});
    engine.Menus().Push(mainMenu);
    engine.Menus().Current()->MoveDown();
    engine.Menus().Current()->Activate(); // fires "Career"

    // --- Audio -------------------------------------------------------------
    const audio::SoundHandle whistle = engine.Audio().LoadSound("Assets/Audio/whistle.wav");
    engine.Audio().Play(whistle, audio::AudioChannel::Effects, 0.8f);

    // --- Input simulation --------------------------------------------------
    rawInput->InjectKey(input::Key::Down, true); // as if the player pressed Down
    engine.Input().Update();
    INF_LOG_INFO("Input action 'MenuDown' active: "
                 << (engine.Input().IsActionActive("MenuDown") ? "yes" : "no"));

    // --- Loading -----------------------------------------------------------
    engine.Loading().Enqueue("warm caches", [] { INF_LOG_DEBUG("loading: warm caches"); });
    engine.Loading().Enqueue("index data", [] { INF_LOG_DEBUG("loading: index data"); });
    engine.Loading().RunAll();
    INF_LOG_INFO("Loading progress: " << engine.Loading().Progress() * 100.0f << "%");

    // --- Save round-trip ---------------------------------------------------
    save::SaveData data;
    data.SetString("profile.name", "Coach");
    data.SetInt("profile.season", 1);
    if (auto st = engine.Save().Save("slot0", data); !st)
    {
        INF_LOG_ERROR("save failed: " << st.Error());
    }
    if (auto loaded = engine.Save().Load("slot0"))
    {
        INF_LOG_INFO("Save round-trip ok: name=" << loaded.Value().GetString("profile.name")
                                                 << " season=" << loaded.Value().GetInt("profile.season"));
    }

    // --- A few engine frames ----------------------------------------------
    for (u64 i = 0; i < 3; ++i)
    {
        engine.Events().Emit(FrameTick{i});
        engine.Update(1.0 / 60.0);
    }

    engine.Events().Unsubscribe(sub);
    engine.Shutdown();

    INF_LOG_INFO("Sandbox finished cleanly");
    return 0;
}
