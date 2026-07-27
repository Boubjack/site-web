# =============================================================================
#  EngineTests — one executable running the dependency-free unit tests, wired
#  into CTest with one test entry per subsystem (via a name filter argument).
#  Covers both the engine foundation and the football game library.
# =============================================================================
add_executable(EngineTests
    TestMain.cpp
    # Engine foundation
    Unit/MathTests.cpp
    Unit/ConfigTests.cpp
    Unit/EventsTests.cpp
    Unit/ResourcesTests.cpp
    Unit/SaveTests.cpp
    Unit/LoggerTests.cpp
    Unit/MenuTests.cpp
    Unit/InputTests.cpp
    Unit/LoadingTests.cpp
    Unit/AudioTests.cpp
    Unit/CameraTests.cpp
    Unit/PhysicsWorldTests.cpp
    # Football game engine (Mission 2)
    Unit/TerrainTests.cpp
    Unit/BallTests.cpp
    Unit/PlayerTests.cpp
    Unit/FormationTests.cpp
    Unit/TeamTests.cpp
    Unit/RulesTests.cpp
    Unit/OffsideTests.cpp
    Unit/MatchEngineTests.cpp
)

# "Framework/TestFramework.hpp" resolves from here; Engine and Football headers
# come in transitively through the linked targets' PUBLIC include dirs.
target_include_directories(EngineTests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(EngineTests PRIVATE inf::football)
target_compile_options(EngineTests PRIVATE ${INF_WARNINGS})

# Register one CTest case per subsystem. The argument is a name filter matched
# as a substring by the test runner, so each entry runs that module's cases.
foreach(suite
        Math Config Events Resources Save Logger Menu Input Loading Audio Camera
        Physics Terrain Ball Player Formation Team Rules Offside MatchEngine)
    add_test(NAME ${suite} COMMAND EngineTests ${suite}_)
endforeach()
