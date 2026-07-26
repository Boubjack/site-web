// =============================================================================
//  Infinity Football — Engine / Core / Assert
//  Lightweight assertion macro. Lives in Core (not Logging) so the most
//  foundational code can assert without creating a dependency cycle.
// =============================================================================
#pragma once

#include <cstdio>
#include <cstdlib>

#include "Engine/Platform/Platform.hpp" // INF_BUILD_DEBUG / INF_BUILD_RELEASE

namespace inf::detail
{
    /// Reports a failed assertion to stderr and aborts. Never returns.
    [[noreturn]] inline void OnAssertFailed(const char* expr, const char* file, int line,
                                            const char* msg)
    {
        std::fprintf(stderr, "[ASSERT] %s:%d: (%s) %s\n", file, line, expr,
                     msg ? msg : "");
        std::abort();
    }
} // namespace inf::detail

#if defined(INF_BUILD_DEBUG)
#    define INF_ASSERT(expr, msg)                                                   \
        do {                                                                        \
            if (!(expr)) {                                                          \
                ::inf::detail::OnAssertFailed(#expr, __FILE__, __LINE__, (msg));    \
            }                                                                       \
        } while (false)
#else
#    define INF_ASSERT(expr, msg) ((void)0)
#endif

// Always-checked variant (kept in release builds too, e.g. for invariants
// whose violation would corrupt saves or crash unpredictably).
#define INF_VERIFY(expr, msg)                                                      \
    do {                                                                           \
        if (!(expr)) {                                                             \
            ::inf::detail::OnAssertFailed(#expr, __FILE__, __LINE__, (msg));       \
        }                                                                          \
    } while (false)
