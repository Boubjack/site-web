# Sandbox — headless boot executable that exercises every engine subsystem.
add_executable(Sandbox main.cpp)

target_link_libraries(Sandbox PRIVATE inf::engine)
target_compile_options(Sandbox PRIVATE ${INF_WARNINGS})
