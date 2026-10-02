import type { Folder } from "../../lib/api/types";
import { navQueryKey } from "../../lib/mail/navigation";
import { useMailStore } from "../../lib/state/mailStore";
import { EmailList } from "./EmailList";
import { EmailReadPane } from "./EmailReadPane";

interface MailViewProps {
  folders: Folder[];
}

export function MailView({ folders }: MailViewProps) {
  const selectedEmailId = useMailStore((state) => state.selectedEmailId);
  const nav = useMailStore((state) => state.nav);

  return (
    <div className={`mail-split-view${selectedEmailId ? " has-reader" : ""}`}>
      <div className="mail-list-pane">
        <EmailList key={navQueryKey(nav)} folders={folders} />
      </div>
      {selectedEmailId && (
        <div className="mail-reader-pane">
          <EmailReadPane emailId={selectedEmailId} />
        </div>
      )}
    </div>
  );
}
