import type { ReactNode } from "react";

interface MailLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  readerOpen?: boolean;
}

export function MailLayout({ sidebar, children, readerOpen = false }: MailLayoutProps) {
  return (
    <div className={`mail-workspace${readerOpen ? " reader-open" : ""}`}>
      <aside className="wm-side" aria-label="Mailbox folders">
        {sidebar}
      </aside>
      <section className="wm-main" aria-label="Mailbox content">
        {children}
      </section>
    </div>
  );
}
