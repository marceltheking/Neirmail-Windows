import { describe, expect, it } from "vitest";
import { ApiError } from "./api/types";
import { shouldRetryQuery } from "./queryClient";

describe("shouldRetryQuery", () => {
  it("retries one transient transport or server failure", () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 0, message: "offline" }))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError({ status: 503, message: "unavailable" }))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError({ status: 503, message: "unavailable" }))).toBe(false);
  });

  it("does not retry client errors or arbitrary exceptions", () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 404, message: "missing" }))).toBe(false);
    expect(shouldRetryQuery(0, new Error("render bug"))).toBe(false);
  });
});
