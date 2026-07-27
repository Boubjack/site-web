# =============================================================================
#  Infinity Football — root build script
#  C++20, dependency-light. Produces:
#    - InfinityFootballEngine  (static engine library)
#    - Sandbox                 (headless boot/smoke executable)
#    - EngineTests             (CTest unit tests)
# =============================================================================
cmake_minimum_required(VERSION 3.20)

project(InfinityFootball
    VERSION 0.0.1
    DESCRIPTION "Offline realistic PC football simulation — engine foundation"
    LANGUAGES CXX)

# --- Global settings ---------------------------------------------------------
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE "Debug" CACHE STRING "Build type" FORCE)
endif()

# Export compile_commands.json for tooling (clang-tidy, IDEs).
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Shared warning flags applied to our own targets (not third-party code).
if(MSVC)
    set(INF_WARNINGS /W4 /permissive-)
else()
    set(INF_WARNINGS -Wall -Wextra -Wpedantic)
endif()

# Opt-in strict mode: -DINF_WERROR=ON turns warnings into errors (used in CI).
option(INF_WERROR "Treat warnings as errors" OFF)
if(INF_WERROR)
    if(MSVC)
        list(APPEND INF_WARNINGS /WX)
    else()
        list(APPEND INF_WARNINGS -Werror)
    endif()
endif()

enable_testing()

add_subdirectory(Source)
add_subdirectory(Tests)
