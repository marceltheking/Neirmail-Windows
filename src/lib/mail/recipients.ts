const SIMPLE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function splitAddresses(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let bracketed = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    else if (character === "<" && !quoted) bracketed = true;
    else if (character === ">" && !quoted) bracketed = false;
    if ((character === "," || character === ";") && !quoted && !bracketed) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function addressOf(recipient: string): string {
  return recipient.match(/<([^<>]+)>\s*$/)?.[1]?.trim() ?? recipient;
}

export function recipientValidationError(to: string, cc = "", bcc = ""): string | null {
  const primary = splitAddresses(to);
  if (primary.length === 0) return "Add at least one recipient before sending.";
  if (primary.length > 1) {
    return "Put one address in To and add the others in Cc or Bcc.";
  }

  for (const [label, value] of [
    ["To", to],
    ["Cc", cc],
    ["Bcc", bcc],
  ] as const) {
    const invalid = splitAddresses(value).find(
      (recipient) => !SIMPLE_EMAIL.test(addressOf(recipient)),
    );
    if (invalid) return `${label} includes an invalid email address: ${invalid}`;
  }

  return null;
}
