import { useEffect, useState } from "react";
import { NeirLogo } from "../shared/NeirLogo";
import { markIntroSeen } from "../../lib/state/intro";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), 600);
    const done = window.setTimeout(() => {
      markIntroSeen();
      onDone();
    }, 860);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className={`app-splash${leaving ? " is-leaving" : ""}`}>
      <div className="app-splash-mark">
        <NeirLogo />
      </div>
      <p>Private mail, clearly yours.</p>
    </div>
  );
}
