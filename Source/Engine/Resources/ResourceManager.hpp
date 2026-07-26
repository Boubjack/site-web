// =============================================================================
//  Infinity Football — Engine / Resources / ResourceManager
//  Caches resources by id and shares ownership through std::shared_ptr, giving
//  automatic reference counting: a resource stays alive while any handle holds
//  it, and PurgeUnused() reclaims those the cache alone still references.
//
//  Loaders are registered per resource type via a factory callback, so new
//  asset kinds are added without modifying the manager (Open/Closed Principle).
// =============================================================================
#pragma once

#include <functional>
#include <memory>
#include <typeindex>
#include <unordered_map>

#include "Engine/Core/Types.hpp"
#include "Engine/Resources/Resource.hpp"

namespace inf::resources
{
    /// Strong, shared handle to a loaded resource.
    template <typename T>
    using ResourceHandle = std::shared_ptr<T>;

    class ResourceManager
    {
    public:
        /// Registers a factory that builds a resource of type T from its id.
        /// Only one loader per type; re-registering replaces the previous one.
        template <typename T>
        void RegisterLoader(std::function<ResourceHandle<T>(const ResourceId&)> loader)
        {
            loaders_[std::type_index(typeid(T))] =
                [loader = std::move(loader)](const ResourceId& id) -> ResourceHandle<Resource> {
                return loader(id);
            };
        }

        /// Returns the cached resource for @p id, loading it via the registered
        /// loader on first request. Returns nullptr if no loader is registered
        /// for T or the loader itself returns nullptr.
        template <typename T>
        ResourceHandle<T> Load(const ResourceId& id)
        {
            if (const auto it = cache_.find(id); it != cache_.end())
            {
                return std::static_pointer_cast<T>(it->second);
            }
            const auto lit = loaders_.find(std::type_index(typeid(T)));
            if (lit == loaders_.end()) { return nullptr; }

            ResourceHandle<Resource> res = lit->second(id);
            if (!res) { return nullptr; }
            cache_[id] = res;
            return std::static_pointer_cast<T>(res);
        }

        /// True if @p id is currently cached.
        [[nodiscard]] bool IsCached(const ResourceId& id) const
        {
            return cache_.find(id) != cache_.end();
        }

        /// Drops cache entries no longer referenced anywhere else (use_count 1).
        /// Returns the number of resources released.
        usize PurgeUnused();

        /// Empties the cache entirely (resources with live handles stay alive).
        void Clear() { cache_.clear(); }

        [[nodiscard]] usize CachedCount() const noexcept { return cache_.size(); }
        [[nodiscard]] usize LoaderCount() const noexcept { return loaders_.size(); }

    private:
        std::unordered_map<ResourceId, ResourceHandle<Resource>> cache_;
        std::unordered_map<std::type_index,
                           std::function<ResourceHandle<Resource>(const ResourceId&)>>
            loaders_;
    };
} // namespace inf::resources
