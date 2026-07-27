# =============================================================================
#  InfinityFootballGame — the football gameplay engine (Mission 2).
#  Depends on the generic engine (inf::engine); contains all football-specific
#  logic. Include root is Source/ ("Game/Football/..." and "Engine/...").
# =============================================================================
add_library(InfinityFootballGame STATIC
    Football/Terrain/Pitch.cpp
    Football/Ball/Ball.cpp
    Football/Player/Player.cpp
    Football/Team/Formation.cpp
    Football/Team/Team.cpp
    Football/Rules/RuleBook.cpp
    Football/Rules/Discipline.cpp
    Football/Rules/Offside.cpp
    Football/Camera/MatchCameraDirector.cpp
    Football/Match/MatchEngine.cpp
    Football/Save/MatchState.cpp
)

add_library(inf::football ALIAS InfinityFootballGame)

target_include_directories(InfinityFootballGame PUBLIC ${CMAKE_SOURCE_DIR}/Source)
target_compile_features(InfinityFootballGame PUBLIC cxx_std_20)
target_compile_options(InfinityFootballGame PRIVATE ${INF_WARNINGS})
target_link_libraries(InfinityFootballGame PUBLIC inf::engine)
