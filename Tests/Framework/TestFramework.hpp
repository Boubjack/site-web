// =============================================================================
//  Infinity Football — Tests / Framework
//  A tiny, dependency-free unit-test framework: register cases with INF_TEST,
//  assert with REQUIRE / REQUIRE_EQ, and run them from a single main via
//  RunAll(). Kept minimal on purpose so the foundation pulls in no third-party
//  test library.
// =============================================================================
#pragma once

#include <cstdio>
#include <exception>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace inf::test
{
    using TestFn = void (*)();

    /// Thrown by a failed REQUIRE; caught per test by the runner.
    struct TestFailure
    {
        std::string message;
    };

    /// Process-wide registry of test cases (function-local static → single
    /// definition even though this header is included in many translation units).
    inline std::vector<std::pair<std::string, TestFn>>& Registry()
    {
        static std::vector<std::pair<std::string, TestFn>> tests;
        return tests;
    }

    /// Static registrar; one instance per INF_TEST adds the case at load time.
    struct Registrar
    {
        Registrar(const char* name, TestFn fn) { Registry().emplace_back(name, fn); }
    };

    /// Runs every registered test whose name contains @p filter ("" = all).
    /// Returns 0 if all pass, 1 otherwise.
    inline int RunAll(const std::string& filter = {})
    {
        int passed = 0;
        int failed = 0;
        for (const auto& [name, fn] : Registry())
        {
            if (!filter.empty() && name.find(filter) == std::string::npos) { continue; }
            try
            {
                fn();
                std::printf("[ PASS ] %s\n", name.c_str());
                ++passed;
            }
            catch (const TestFailure& f)
            {
                std::printf("[ FAIL ] %s\n         %s\n", name.c_str(), f.message.c_str());
                ++failed;
            }
            catch (const std::exception& e)
            {
                std::printf("[ FAIL ] %s\n         unexpected exception: %s\n", name.c_str(),
                            e.what());
                ++failed;
            }
        }
        std::printf("---- %d passed, %d failed ----\n", passed, failed);
        return failed == 0 ? 0 : 1;
    }
} // namespace inf::test

// --- Macros -----------------------------------------------------------------
#define INF_TEST(name)                                                             \
    static void name();                                                            \
    static ::inf::test::Registrar inf_reg_##name(#name, name);                     \
    static void name()

#define REQUIRE(cond)                                                              \
    do {                                                                           \
        if (!(cond)) {                                                             \
            std::ostringstream _oss;                                               \
            _oss << __FILE__ << ":" << __LINE__ << ": REQUIRE(" << #cond << ")";   \
            throw ::inf::test::TestFailure{_oss.str()};                            \
        }                                                                          \
    } while (false)

#define REQUIRE_EQ(a, b)                                                           \
    do {                                                                           \
        const auto _va = (a);                                                      \
        const auto _vb = (b);                                                      \
        if (!(_va == _vb)) {                                                       \
            std::ostringstream _oss;                                               \
            _oss << __FILE__ << ":" << __LINE__ << ": REQUIRE_EQ(" << #a << ", "   \
                 << #b << ") got " << _va << " != " << _vb;                        \
            throw ::inf::test::TestFailure{_oss.str()};                            \
        }                                                                          \
    } while (false)
