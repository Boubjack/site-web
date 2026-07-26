# =============================================================================
#  EngineTests — one executable running the dependency-free unit tests, wired
#  into CTest with one test entry per subsystem (via a name filter argument).
# =============================================================================
add_executable(EngineTests
    TestMain.cpp
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
)

# "Framework/TestFramework.hpp" resolves from here; Engine headers come in
# transitively through the engine target's PUBLIC include dir.
target_include_directories(EngineTests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(EngineTests PRIVATE inf::engine)
target_compile_options(EngineTests PRIVATE ${INF_WARNINGS})

# Register one CTest case per subsystem. The argument is a name filter matched
# as a substring by the test runner, so each entry runs that module's cases.
foreach(suite Math Config Events Resources Save Logger Menu Input Loading Audio Camera)
    add_test(NAME ${suite} COMMAND EngineTests ${suite}_)
endforeach()
