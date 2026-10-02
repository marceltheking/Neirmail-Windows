import { Modal } from "./Modal";

const GROUPS: Array<{ title: string; items: Array<[string[], string]> }> = [
  {
    title: "Anywhere",
    items: [
      [["C"], "New message"],
      [["/"], "Search mail"],
      [["Ctrl", "L"], "Lock Neir Mail"],
      [["?"], "Show these shortcuts"],
    ],
  },
  {
    title: "Message list",
    items: [
      [["J"], "Next message"],
      [["K"], "Previous message"],
    ],
  },
  {
    title: "Open message",
    items: [
      [["R"], "Reply"],
      [["A"], "Reply all"],
      [["F"], "Forward"],
      [["E"], "Archive"],
      [["S"], "Star or unstar"],
      [["U"], "Mark unread"],
      [["#"], "Move to trash"],
      [["Esc"], "Close message"],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" size="md" onClose={onClose}>
      <div className="shortcut-groups">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcut-group">
            <h3>{group.title}</h3>
            <dl>
              {group.items.map(([keys, label]) => (
                <div key={label} className="shortcut-row">
                  <dt>{label}</dt>
                  <dd>
                    {keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
