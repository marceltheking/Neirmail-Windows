import { useEffect, useState, type CSSProperties } from "react";
import { avatarText, senderIconDomain } from "../../lib/mail/senderIcon";
import { useSenderIconStore } from "../../lib/state/senderIconStore";

interface SenderAvatarProps {
  name: string | null | undefined;
  address: string | null | undefined;
  className: string;
}

export function SenderAvatar({ name, address, className }: SenderAvatarProps) {
  const domain = senderIconDomain(address);
  const entry = useSenderIconStore((state) => (domain ? state.entries[domain] : undefined));
  const request = useSenderIconStore((state) => state.request);
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (domain) request(domain);
  }, [domain, request]);

  const icon = entry?.status === "ready" ? entry : null;
  const ready = Boolean(icon?.url) && loaded === icon?.url;
  const classes = [className];
  if (icon?.look && icon.source) {
    classes.push(
      icon.source === "bimi" ? "wm-av-bimi" : "wm-av-favicon",
      `wm-av-k-${icon.look.kind}`,
    );
  }
  if (ready) classes.push("wm-av-ready");
  const style: CSSProperties | undefined =
    icon?.look?.kind === "solid" ? { background: icon.look.color } : undefined;

  return (
    <span className={classes.join(" ")} style={style} aria-hidden="true">
      {avatarText(name, address)}
      {icon?.url && (
        <img
          key={icon.url}
          className={`wm-av-img${ready ? " loaded" : ""}`}
          src={icon.url}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(icon.url ?? null)}
          onError={(event) => event.currentTarget.remove()}
        />
      )}
    </span>
  );
}
