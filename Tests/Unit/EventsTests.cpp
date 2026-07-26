// Unit tests — Events subsystem.
#include "Engine/Events/EventBus.hpp"
#include "Framework/TestFramework.hpp"

using namespace inf::events;

namespace
{
    struct Ping { int value; };
    struct Pong { };
} // namespace

INF_TEST(Events_EmitReachesSubscribers)
{
    EventBus bus;
    int total = 0;
    bus.Subscribe<Ping>([&](const Ping& p) { total += p.value; });
    bus.Subscribe<Ping>([&](const Ping& p) { total += p.value * 2; });

    bus.Emit(Ping{10});
    REQUIRE_EQ(total, 30); // 10 + 20
    REQUIRE_EQ(bus.SubscriberCount<Ping>(), static_cast<inf::usize>(2));
    REQUIRE_EQ(bus.SubscriberCount<Pong>(), static_cast<inf::usize>(0));
}

INF_TEST(Events_UnsubscribeStopsDelivery)
{
    EventBus bus;
    int count = 0;
    auto sub = bus.Subscribe<Ping>([&](const Ping&) { ++count; });

    bus.Emit(Ping{1});
    REQUIRE_EQ(count, 1);

    bus.Unsubscribe(sub);
    bus.Emit(Ping{1});
    REQUIRE_EQ(count, 1); // unchanged after unsubscribe
    REQUIRE_EQ(bus.SubscriberCount<Ping>(), static_cast<inf::usize>(0));
}
