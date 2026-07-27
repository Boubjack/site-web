# Tools/

Standalone developer tooling built on top of the engine libraries: data
editors, asset pipeline utilities, validators, and importers.

No tools are shipped in Mission 1 (foundation only). Each future tool lives in
its own subfolder with its own `CMakeLists.txt` and links against the engine
targets rather than duplicating engine code.
