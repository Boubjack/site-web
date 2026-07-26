// =============================================================================
//  Infinity Football — Engine / Platform
//  Compile-time platform & compiler detection and portable helper macros.
//  This is the most foundational header: it depends on nothing.
// =============================================================================
#pragma once

// --- Operating system -------------------------------------------------------
#if defined(_WIN32)
#    define INF_PLATFORM_WINDOWS 1
#    define INF_PLATFORM_NAME "Windows"
#elif defined(__APPLE__)
#    define INF_PLATFORM_MACOS 1
#    define INF_PLATFORM_NAME "macOS"
#elif defined(__linux__)
#    define INF_PLATFORM_LINUX 1
#    define INF_PLATFORM_NAME "Linux"
#else
#    define INF_PLATFORM_UNKNOWN 1
#    define INF_PLATFORM_NAME "Unknown"
#endif

// --- Compiler ---------------------------------------------------------------
#if defined(__clang__)
#    define INF_COMPILER_CLANG 1
#    define INF_COMPILER_NAME "Clang"
#elif defined(__GNUC__)
#    define INF_COMPILER_GCC 1
#    define INF_COMPILER_NAME "GCC"
#elif defined(_MSC_VER)
#    define INF_COMPILER_MSVC 1
#    define INF_COMPILER_NAME "MSVC"
#else
#    define INF_COMPILER_NAME "Unknown"
#endif

// --- Build configuration ----------------------------------------------------
#if defined(NDEBUG)
#    define INF_BUILD_RELEASE 1
#    define INF_BUILD_NAME "Release"
#else
#    define INF_BUILD_DEBUG 1
#    define INF_BUILD_NAME "Debug"
#endif

// --- Portable helper macros -------------------------------------------------
// Force inline where it matters for hot paths on a mid-range PC.
#if defined(INF_COMPILER_MSVC)
#    define INF_FORCE_INLINE __forceinline
#else
#    define INF_FORCE_INLINE inline __attribute__((always_inline))
#endif

// Mark a symbol as intentionally unused (avoids -Wunused warnings).
#define INF_UNUSED(x) (void)(x)

// The engine currently builds as a static library, so no dllexport/import is
// required. INF_API is defined (empty) now so signatures never change if a
// shared-library build is introduced later.
#define INF_API
