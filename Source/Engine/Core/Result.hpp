// =============================================================================
//  Infinity Football — Engine / Core / Result
//  A tiny success-or-error return type used across subsystems for operations
//  that can fail without throwing (config loading, save I/O, resource loading).
//  std::expected is C++23; this is the C++20-friendly equivalent we need.
// =============================================================================
#pragma once

#include <optional>
#include <utility>

#include "Engine/Core/Types.hpp"

namespace inf
{
    /// Outcome of an operation that either yields a value of type T or fails
    /// with a human-readable error message.
    template <typename T>
    class Result
    {
    public:
        static Result Ok(T value) { return Result(std::move(value)); }
        static Result Err(String message) { return Result(std::move(message), true); }

        [[nodiscard]] bool IsOk() const noexcept { return value_.has_value(); }
        [[nodiscard]] explicit operator bool() const noexcept { return IsOk(); }

        /// Precondition: IsOk(). Access the contained value.
        [[nodiscard]] const T& Value() const { return *value_; }
        [[nodiscard]] T& Value() { return *value_; }

        /// Precondition: !IsOk(). Access the error message.
        [[nodiscard]] const String& Error() const noexcept { return error_; }

    private:
        explicit Result(T value) : value_(std::move(value)) {}
        Result(String message, bool /*isError*/) : error_(std::move(message)) {}

        std::optional<T> value_{};
        String error_{};
    };

    /// Result specialization for operations that return nothing on success.
    class Status
    {
    public:
        static Status Ok() { return Status(true, {}); }
        static Status Err(String message) { return Status(false, std::move(message)); }

        [[nodiscard]] bool IsOk() const noexcept { return ok_; }
        [[nodiscard]] explicit operator bool() const noexcept { return ok_; }
        [[nodiscard]] const String& Error() const noexcept { return error_; }

    private:
        Status(bool ok, String message) : ok_(ok), error_(std::move(message)) {}

        bool ok_{false};
        String error_{};
    };
} // namespace inf
