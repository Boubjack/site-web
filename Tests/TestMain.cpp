// =============================================================================
//  Infinity Football — Tests entry point
//  Runs all registered tests, or only those matching an optional name filter
//  passed as argv[1] (used by CTest to run one case per registered test).
// =============================================================================
#include <string>

#include "Framework/TestFramework.hpp"

int main(int argc, char** argv)
{
    const std::string filter = argc > 1 ? argv[1] : std::string{};
    return inf::test::RunAll(filter);
}
