# Builds/

Out-of-source build output directory (CMake binary dir, compiled objects, the
`Sandbox` executable and test binaries).

Everything inside is generated and **ignored by git** (see `.gitignore`); only
this README and the `.gitignore` are tracked so the folder always exists.

## Usage

```sh
cmake -S . -B Builds -G Ninja
cmake --build Builds
ctest --test-dir Builds --output-on-failure
```

Delete the directory contents at any time to force a clean rebuild.
