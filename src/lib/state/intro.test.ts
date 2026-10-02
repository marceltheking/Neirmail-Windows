import { describe, expect, it, vi } from "vitest";
import { hasSeenIntro, INTRO_SEEN_KEY, markIntroSeen } from "./intro";

describe("intro state", () => {
  it("skips the timed intro after it has been seen", () => {
    const storage = {
      getItem: vi.fn(() => "true"),
      setItem: vi.fn(),
    };

    expect(hasSeenIntro(storage)).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith(INTRO_SEEN_KEY);
  });

  it("fails open when hardened storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("denied");
      }),
    };

    expect(hasSeenIntro(storage)).toBe(false);
    expect(() => markIntroSeen(storage)).not.toThrow();
  });
});
