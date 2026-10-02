import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ShieldCheck } from "@phosphor-icons/react";
import { fetchRemoteImage } from "../../lib/api/endpoints/attachments";
import { Button } from "../ui/Button";
import { useQuery } from "@tanstack/react-query";
import { getPreferences } from "../../lib/api/endpoints/settings";
import { openEmailLink } from "../../lib/mail/links";
import {
  EMAIL_FRAME_SANDBOX,
  MAX_EMAIL_FRAME_HEIGHT,
  blockRemoteImages,
  remoteImageUrl,
  sanitizeEmailHtml,
  wrapEmailDocument,
} from "../../lib/mail/emailHtmlSanitizer";

function EmailFrame({ sanitized }: { sanitized: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [hasRemoteImages, setHasRemoteImages] = useState(false);
  const [frameHeight, setFrameHeight] = useState(80);
  useQuery({ queryKey: ["preferences"], queryFn: getPreferences });
  const srcDoc = useMemo(() => wrapEmailDocument(sanitized), [sanitized]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    setHasRemoteImages(blockRemoteImages(doc));

    doc.querySelectorAll("a[href], area[href]").forEach((anchor) => {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noreferrer noopener");
    });
    const openLink = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href], area[href]");
      if (!anchor) return;
      event.preventDefault();
      openEmailLink(anchor.getAttribute("href") ?? "");
    };
    doc.addEventListener("click", openLink);
    doc.addEventListener("auxclick", openLink);
    doc.addEventListener("dragstart", (event) => event.preventDefault());
    let lastActivity = 0;
    const relayActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      window.dispatchEvent(new Event("mousemove"));
    };
    for (const name of ["mousemove", "mousedown", "wheel", "keydown", "touchstart"]) {
      doc.addEventListener(name, relayActivity, { passive: true });
    }

    const resize = () => {
      const next = doc.documentElement
        ? Math.min(doc.documentElement.scrollHeight + 24, MAX_EMAIL_FRAME_HEIGHT)
        : 80;
      setFrameHeight(next);
    };
    resize();
    observerRef.current?.disconnect();
    if (typeof ResizeObserver !== "undefined" && doc.body) {
      observerRef.current = new ResizeObserver(resize);
      observerRef.current.observe(doc.body);
    }
  }

  async function loadImages() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || loadingImages) return;
    setLoadingImages(true);
    const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img[data-neir-src]"));
    await Promise.all(
      images.slice(0, 30).map(async (image) => {
        const source = image.getAttribute("data-neir-src");
        if (!source || !remoteImageUrl(source)) return;
        try {
          image.src = await fetchRemoteImage(source);
          image.removeAttribute("data-neir-src");
        } catch {
          image.alt = image.alt || "Remote image unavailable";
        }
      }),
    );
    setLoadingImages(false);
    setImagesLoaded(true);
  }

  return (
    <div className="mail-html-wrap">
      {hasRemoteImages && !imagesLoaded && (
        <div className="mail-image-privacy">
          <ShieldCheck weight="duotone" />
          <div>
            <strong>Remote images are blocked</strong>
            <span>
              Loading them through Neir's privacy proxy prevents direct contact with the sender.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Image />}
            loading={loadingImages}
            onClick={loadImages}
          >
            Load images
          </Button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Email content"
        className="mail-html-iframe"
        sandbox={EMAIL_FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        style={{ height: frameHeight }}
        srcDoc={srcDoc}
        onLoad={handleLoad}
      />
    </div>
  );
}

export function EmailHtmlBody({ html }: { html: string }) {
  const sanitized = useMemo(() => sanitizeEmailHtml(html), [html]);
  return <EmailFrame key={sanitized} sanitized={sanitized} />;
}
