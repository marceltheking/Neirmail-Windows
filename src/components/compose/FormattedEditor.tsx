import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { fetchRemoteImage } from "../../lib/api/endpoints/attachments";
import {
  ORIGINAL_SOURCE_ATTRIBUTE,
  cleanComposeHtml,
  holdRemoteImages,
  isComposeDocument,
  prepareEditorHtml,
  serializeComposeBody,
  wrapComposeDocument,
  type ComposedHtml,
} from "../../lib/mail/composeHtml";

export const COMPOSE_FRAME_SANDBOX = "allow-same-origin";
const SNAPSHOT_INTERVAL_MS = 1500;

export interface FormattedEditorHandle {
  read: () => ComposedHtml;
  insert: (html: string) => void;
  focus: () => void;
}

interface FormattedEditorProps {
  initialHtml: string;
  disabled?: boolean;
  onReady?: (composed: ComposedHtml) => void;
  onSnapshot?: (composed: ComposedHtml) => void;
  onImagesRemoved?: (count: number) => void;
}

function placeCaretAtEnd(doc: Document) {
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  range.collapse(false);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export const FormattedEditor = forwardRef<FormattedEditorHandle, FormattedEditorProps>(
  function FormattedEditor({ initialHtml, disabled, onReady, onSnapshot, onImagesRemoved }, ref) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const snapshotRef = useRef<ComposedHtml | null>(null);
    const loadedDocumentRef = useRef<Document | null>(null);
    const loadedRef = useRef(new Map<string, string>());
    const [srcDoc] = useState(() => wrapComposeDocument(prepareEditorHtml(initialHtml)));

    function liveDocument(): Document | null {
      const doc = frameRef.current?.contentDocument;
      return doc && doc === loadedDocumentRef.current && doc.body ? doc : null;
    }

    function showHeldImages(doc: Document) {
      holdRemoteImages(doc);
      doc
        .querySelectorAll<HTMLImageElement>(`img[${ORIGINAL_SOURCE_ATTRIBUTE}]`)
        .forEach((image) => {
          if (image.getAttribute("src")) return;
          const original = image.getAttribute(ORIGINAL_SOURCE_ATTRIBUTE) ?? "";
          const cached = loadedRef.current.get(original);
          if (cached) {
            image.setAttribute("src", cached);
            return;
          }
          image.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAAAAACw=");
          void fetchRemoteImage(original)
            .then((dataUri) => {
              loadedRef.current.set(original, dataUri);
              if (image.getAttribute(ORIGINAL_SOURCE_ATTRIBUTE) === original) {
                image.setAttribute("src", dataUri);
              }
            })
            .catch(() => {
              image.alt = image.alt || "Image unavailable in preview";
            });
        });
    }

    function snapshot(): ComposedHtml | null {
      const doc = liveDocument();
      if (!doc) return snapshotRef.current;
      showHeldImages(doc);
      snapshotRef.current = serializeComposeBody(doc.body);
      onSnapshot?.(snapshotRef.current);
      return snapshotRef.current;
    }

    function insert(html: string) {
      const doc = liveDocument();
      if (!doc) return;
      const cleaned = cleanComposeHtml(html);
      if (cleaned.removedImages) onImagesRemoved?.(cleaned.removedImages);
      const template = doc.createElement("template");
      template.innerHTML = prepareEditorHtml(cleaned.html);
      const fragment = template.content;
      const last = fragment.lastChild;
      doc.body.focus();
      const selection = doc.getSelection();
      if (!selection || selection.rangeCount === 0) {
        doc.body.appendChild(fragment);
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(fragment);
        if (last) {
          range.setStartAfter(last);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      showHeldImages(doc);
    }

    useImperativeHandle(ref, () => ({
      read: () => snapshot() ?? fallbackComposition(initialHtml),
      insert,
      focus: () => {
        const doc = liveDocument();
        if (!doc) return;
        frameRef.current?.focus();
        doc.body.focus();
      },
    }));

    useEffect(() => {
      const timer = window.setInterval(snapshot, SNAPSHOT_INTERVAL_MS);
      return () => window.clearInterval(timer);
    });

    useEffect(() => {
      const doc = liveDocument();
      if (doc) doc.designMode = disabled ? "off" : "on";
    }, [disabled]);

    function handleLoad() {
      const doc = frameRef.current?.contentDocument;
      if (!doc || !isComposeDocument(doc)) return;
      loadedDocumentRef.current = doc;
      doc.designMode = disabled ? "off" : "on";
      doc.addEventListener("paste", (event) => {
        const html = event.clipboardData?.getData("text/html");
        if (!html) return;
        event.preventDefault();
        insert(html);
      });
      showHeldImages(doc);
      frameRef.current?.focus();
      doc.body.focus();
      placeCaretAtEnd(doc);
      const composed = serializeComposeBody(doc.body);
      snapshotRef.current = composed;
      onReady?.(composed);
    }

    return (
      <iframe
        ref={frameRef}
        title="Formatted message"
        aria-label="Message body"
        className="compose-editor compose-editor-html"
        sandbox={COMPOSE_FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        onLoad={handleLoad}
      />
    );
  },
);

function fallbackComposition(initialHtml: string): ComposedHtml {
  const body = document.createElement("body");
  body.innerHTML = initialHtml;
  return serializeComposeBody(body);
}
