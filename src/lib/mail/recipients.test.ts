import { describe, expect, it } from "vitest";
import { recipientValidationError, splitAddresses } from "./recipients";

describe("recipientValidationError", () => {
  it("requires a primary recipient", () => {
    expect(recipientValidationError("")).toBe("Add at least one recipient before sending.");
    expect(recipientValidationError(" , ")).toBe("Add at least one recipient before sending.");
  });

  it("accepts display names and Cc lists", () => {
    expect(
      recipientValidationError("Ada <ada@example.com>", "linus@example.org, team@example.net"),
    ).toBeNull();
  });

  it("allows exactly one primary recipient, like the server", () => {
    expect(recipientValidationError("ada@example.com, linus@example.org")).toBe(
      "Put one address in To and add the others in Cc or Bcc.",
    );
  });

  it("identifies the invalid recipient field", () => {
    expect(recipientValidationError("ada@example.com", "not-an-address")).toBe(
      "Cc includes an invalid email address: not-an-address",
    );
  });
});

describe("splitAddresses", () => {
  it("keeps commas inside quoted display names", () => {
    expect(splitAddresses('"Lovelace, Ada" <ada@example.com>; linus@example.org')).toEqual([
      '"Lovelace, Ada" <ada@example.com>',
      "linus@example.org",
    ]);
  });
});
