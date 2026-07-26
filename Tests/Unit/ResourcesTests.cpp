// Unit tests — Resources subsystem (cache + reference counting).
#include <memory>
#include <string>

#include "Engine/Resources/Resource.hpp"
#include "Engine/Resources/ResourceManager.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::resources;

namespace
{
    class Blob final : public Resource
    {
    public:
        explicit Blob(ResourceId id) : Resource(std::move(id)) {}
    };
} // namespace

INF_TEST(Resources_LoadCachesAndReuses)
{
    ResourceManager mgr;
    int loads = 0;
    mgr.RegisterLoader<Blob>([&](const ResourceId& id) {
        ++loads;
        return std::make_shared<Blob>(id);
    });

    auto a = mgr.Load<Blob>("x");
    auto b = mgr.Load<Blob>("x");
    REQUIRE(a == b);            // same cached instance
    REQUIRE_EQ(loads, 1);       // loader ran only once
    REQUIRE(mgr.IsCached("x"));
    REQUIRE_EQ(mgr.CachedCount(), static_cast<inf::usize>(1));
}

INF_TEST(Resources_PurgeUnusedRespectsHandles)
{
    ResourceManager mgr;
    mgr.RegisterLoader<Blob>([](const ResourceId& id) { return std::make_shared<Blob>(id); });

    auto held = mgr.Load<Blob>("keep");
    mgr.Load<Blob>("drop"); // no external handle retained

    const inf::usize purged = mgr.PurgeUnused();
    REQUIRE_EQ(purged, static_cast<inf::usize>(1)); // only "drop" released
    REQUIRE(mgr.IsCached("keep"));
    REQUIRE(!mgr.IsCached("drop"));
}

INF_TEST(Resources_MissingLoaderReturnsNull)
{
    ResourceManager mgr;
    auto r = mgr.Load<Blob>("nope");
    REQUIRE(r == nullptr);
}
