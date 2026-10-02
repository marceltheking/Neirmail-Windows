export const INTRO_SEEN_KEY = "neirmail-intro-seen";

type IntroStorage = Pick<Storage, "getItem" | "setItem">;

export function hasSeenIntro(storage: IntroStorage = window.localStorage) {
  try {
    return storage.getItem(INTRO_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markIntroSeen(storage: IntroStorage = window.localStorage) {
  try {
    storage.setItem(INTRO_SEEN_KEY, "true");
  } catch {}
}
