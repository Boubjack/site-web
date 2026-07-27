# MatchSim — headless executable that runs a full football match to full time.
add_executable(MatchSim main.cpp)

target_link_libraries(MatchSim PRIVATE inf::football)
target_compile_options(MatchSim PRIVATE ${INF_WARNINGS})
