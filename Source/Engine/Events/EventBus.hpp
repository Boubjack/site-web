// =============================================================================
//  Infinity Football — Engine / Events / EventBus
//  Type-indexed publish/subscribe. Any copyable struct is an event type; there
//  is no common base class to inherit, keeping event definitions trivial and
//  decoupled. Subscriptions return a token that unsubscribes on request.
//
//  Immediate delivery: Emit<T>() invokes every subscriber synchronously.
//  For deferred, frame-boundary delivery use EventQueue.
// =============================================================================
#pragma once

#include <functional>
#include <memory>
#include <typeindex>
#include <unordered_map>
#include <vector>

#include "Engine/Core/Types.hpp"

namespace inf::events
{
    /// Opaque handle used to unsubscribe. Default-constructed handles are invalid.
    class Subscription
    {
    public:
        Subscription() = default;
        Subscription(std::type_index type, u64 id) : type_(type), id_(id), valid_(true) {}

        [[nodiscard]] bool Valid() const noexcept { return valid_; }

    private:
        friend class EventBus;
        std::type_index type_{typeid(void)};
        u64 id_{0};
        bool valid_{false};
    };

    class EventBus
    {
    public:
        /// Registers @p handler for events of type T. The returned Subscription
        /// can be passed to Unsubscribe().
        template <typename T>
        Subscription Subscribe(std::function<void(const T&)> handler)
        {
            auto& list = handlers_[std::type_index(typeid(T))];
            const u64 id = ++nextId_;
            list.push_back(Entry{id, [h = std::move(handler)](const void* e) {
                                     h(*static_cast<const T*>(e));
                                 }});
            return Subscription{std::type_index(typeid(T)), id};
        }

        /// Synchronously delivers @p event to every current subscriber of T.
        template <typename T>
        void Emit(const T& event)
        {
            const auto it = handlers_.find(std::type_index(typeid(T)));
            if (it == handlers_.end()) { return; }
            // Copy the list so a handler may (un)subscribe during delivery.
            const auto snapshot = it->second;
            for (const auto& entry : snapshot)
            {
                entry.fn(&event);
            }
        }

        /// Removes a previously registered handler. Safe to call with an
        /// invalid or already-removed subscription.
        void Unsubscribe(const Subscription& sub);

        /// Number of active subscribers for event type T.
        template <typename T>
        [[nodiscard]] usize SubscriberCount() const
        {
            const auto it = handlers_.find(std::type_index(typeid(T)));
            return it == handlers_.end() ? 0 : it->second.size();
        }

    private:
        struct Entry
        {
            u64 id;
            std::function<void(const void*)> fn;
        };

        std::unordered_map<std::type_index, std::vector<Entry>> handlers_;
        u64 nextId_{0};
    };
} // namespace inf::events
