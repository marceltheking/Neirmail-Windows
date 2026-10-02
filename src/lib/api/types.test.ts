import { describe, expect, it } from "vitest";
import { ApiError, normalizeApiError } from "./types";

describe("normalizeApiError", () => {
  it("preserves structured native errors", () => {
    expect(
      normalizeApiError({ status: 429, code: "RATE_LIMITED", message: "Try again later." }),
    ).toEqual({ status: 429, code: "RATE_LIMITED", message: "Try again later." });
  });

  it("parses JSON-serialized errors and nested response errors", () => {
    expect(normalizeApiError('{"status":401,"message":"Sign in again."}')).toEqual({
      status: 401,
      code: null,
      message: "Sign in again.",
    });
    expect(normalizeApiError({ error: { status: 503, message: "Unavailable" } })).toEqual({
      status: 503,
      code: null,
      message: "Unavailable",
    });
  });

  it("always provides a safe fallback", () => {
    const error = ApiError.fromUnknown(null);
    expect(error.status).toBe(0);
    expect(error.message).toBe("The request could not be completed.");
  });
});
