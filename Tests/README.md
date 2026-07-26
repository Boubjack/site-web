# Tests/

Automated tests for the engine subsystems, built and run through CTest.

Mission 1 ships a small, dependency-free test framework
(`Tests/Framework/TestFramework.hpp`) and unit tests for every logic-bearing
subsystem. No external test library is used, keeping the foundation
dependency-light.

## Layout

```
Tests/
  Framework/          Header-only assertion + test-registry framework
  Unit/               One .cpp per subsystem under test
  CMakeLists.txt      Builds the test runner and registers CTest cases
```

## Running

```sh
cmake -S . -B Builds -G Ninja
cmake --build Builds
ctest --test-dir Builds --output-on-failure
```

Every test must be deterministic and must leave no files behind outside a
temporary directory.
