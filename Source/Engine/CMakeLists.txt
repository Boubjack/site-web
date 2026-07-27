# =============================================================================
#  InfinityFootballEngine — static library of the engine foundation subsystems.
#  Header include root is Source/, so all headers are referenced as
#  "Engine/<Module>/<File>.hpp" throughout the codebase.
# =============================================================================
add_library(InfinityFootballEngine STATIC
    Core/Engine.cpp
    Core/Application.cpp
    Logging/Logger.cpp
    Config/ConfigValue.cpp
    Config/ConfigFile.cpp
    Config/ConfigManager.cpp
    Events/EventBus.cpp
    Physics/PhysicsWorld.cpp
    Resources/ResourceManager.cpp
    Save/SaveData.cpp
    Save/Serializer.cpp
    Save/SaveManager.cpp
    Audio/AudioSystem.cpp
    Input/InputCodes.cpp
    Input/InputSystem.cpp
    Camera/CameraController.cpp
    Menu/MenuModel.cpp
    Menu/MenuStack.cpp
    Loading/LoadingQueue.cpp
    Loading/StateMachine.cpp
)

# A stable alias so consumers can link inf::engine.
add_library(inf::engine ALIAS InfinityFootballEngine)

target_include_directories(InfinityFootballEngine PUBLIC
    ${CMAKE_SOURCE_DIR}/Source)

target_compile_features(InfinityFootballEngine PUBLIC cxx_std_20)
target_compile_options(InfinityFootballEngine PRIVATE ${INF_WARNINGS})
