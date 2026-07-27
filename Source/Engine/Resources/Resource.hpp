// =============================================================================
//  Infinity Football — Engine / Resources / Resource
//  Base type for anything the ResourceManager caches (textures, audio banks,
//  data tables, ...). Concrete resource types derive from Resource; the manager
//  only ever handles them through shared_ptr<Resource>.
// =============================================================================
#pragma once

#include "Engine/Core/Types.hpp"

namespace inf::resources
{
    /// Logical identifier of a resource — currently its relative asset path.
    using ResourceId = String;

    class Resource
    {
    public:
        explicit Resource(ResourceId id) : id_(std::move(id)) {}
        virtual ~Resource() = default;

        [[nodiscard]] const ResourceId& Id() const noexcept { return id_; }

    private:
        ResourceId id_;
    };
} // namespace inf::resources
