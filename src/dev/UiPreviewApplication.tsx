import type { EmailDetail, EmailListItem, Folder, Me, Preferences } from "../lib/api/types";
import { storeKeySession } from "../lib/crypto/keySession";
import { queryClient } from "../lib/queryClient";
import { useAuthStore } from "../lib/state/authStore";
import { useMailStore } from "../lib/state/mailStore";
import { DesktopApplication } from "../components/layout/DesktopApplication";

const folders: Folder[] = [
  {
    id: "folder-inbox",
    name: "Inbox",
    type: "inbox",
    iconClass: null,
    unreadCount: 3,
    totalCount: 12,
  },
  {
    id: "folder-sent",
    name: "Sent",
    type: "sent",
    iconClass: null,
    unreadCount: 0,
    totalCount: 8,
  },
  {
    id: "folder-drafts",
    name: "Drafts",
    type: "drafts",
    iconClass: null,
    unreadCount: 0,
    totalCount: 2,
  },
  {
    id: "folder-spam",
    name: "Spam",
    type: "spam",
    iconClass: null,
    unreadCount: 0,
    totalCount: 1,
  },
  {
    id: "folder-archive",
    name: "Archive",
    type: "archive",
    iconClass: null,
    unreadCount: 0,
    totalCount: 5,
  },
  {
    id: "folder-trash",
    name: "Trash",
    type: "trash",
    iconClass: null,
    unreadCount: 0,
    totalCount: 3,
  },
  {
    id: "folder-receipts",
    name: "Receipts",
    type: "custom",
    iconClass: null,
    unreadCount: 0,
    totalCount: 6,
  },
];

const emails: EmailListItem[] = [
  {
    ...previewEmail(
      "mail-0",
      "Neir System",
      "hello@neir.io",
      "SageSwap.io: swap privately, no KYC",
      false,
    ),
    isPinned: true,
    linkUrl: "https://sageswap.io/",
  },
  previewEmail("mail-2", "Neir System", "hello@neir.io", "Your encrypted export is ready", false),
  previewEmail(
    "mail-1",
    "Mara Nilsson",
    "mara@studio.example",
    "Project notes for Thursday",
    false,
    true,
  ),
  previewEmail(
    "mail-3",
    "Lin Chen",
    "lin@field.example",
    "Re: quiet tools and good defaults",
    false,
  ),
  previewEmail("mail-4", null, "receipts@rail.example", "Train receipt · Stockholm", true, true),
  previewEmail("mail-5", "Ada", "ada@research.example", "Reading list for the weekend", true),
];

const me: Me = {
  userId: "preview-account",
  displayName: "Avery",
  plan: "pro",
  storageQuotaBytes: 5 * 1024 * 1024 * 1024,
  status: "active",
  isAdmin: false,
  sendingEnabled: true,
  twofaActive: true,
};

const preferences: Preferences = {
  displayName: "Avery",
  autoDeleteReadEmailsDays: 90,
  autoDeleteInactiveAccountEnabled: false,
  desktopNotificationsEnabled: true,
  trackEmailOpens: false,
  compactViewEnabled: false,
  lightModeEnabled: false,
  stripImageMetadataEnabled: true,
  stripDocumentMetadataEnabled: true,
  stripTrackingParamsEnabled: true,
  firstTimeSenderWarningEnabled: true,
  lookalikeDomainWarningEnabled: true,
  autoSignOutgoingEmail: false,
};

installFixtures();

export function UiPreviewApplication() {
  return <DesktopApplication />;
}

function installFixtures() {
  for (const key of [
    ["folders"],
    ["preferences"],
    ["emails"],
    ["account-summary"],
    ["addresses"],
    ["contacts"],
    ["filters"],
    ["sessions"],
    ["app-passwords"],
    ["pgp-settings"],
    ["email"],
  ]) {
    queryClient.setQueryDefaults(key, { staleTime: Number.POSITIVE_INFINITY });
  }
  useAuthStore.setState({ phase: "authenticated", me });
  useMailStore.setState({
    nav: { kind: "inbox", folderId: "folder-inbox" },
    selectedEmailId: null,
    selectedIds: new Set(),
  });
  queryClient.setQueryData(["folders"], folders);
  queryClient.setQueryData(["preferences"], preferences);
  queryClient.setQueryData(["emails", "inbox", "folder-inbox", 1, "date_desc", ""], {
    emails,
    total: emails.length,
    page: 1,
    limit: 25,
  });
  queryClient.setQueryData(["account-summary"], {
    userId: me.userId,
    displayName: me.displayName,
    status: "Active",
    primaryAddress: "avery@neir.io",
    aliases: [],
    storageQuotaBytes: String(me.storageQuotaBytes),
    usedBytes: String(1_247_805_440),
  });
  queryClient.setQueryData(
    ["addresses"],
    [
      {
        id: "address-primary",
        address: "avery@neir.io",
        type: "primary",
        catchAll: false,
        isRandomAlias: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "address-alias",
        address: "quiet-forest@neirmail.com",
        type: "alias",
        catchAll: false,
        isRandomAlias: false,
        createdAt: new Date().toISOString(),
      },
    ],
  );
  queryClient.setQueryData(["contacts"], []);
  queryClient.setQueryData(["filters"], []);
  queryClient.setQueryData(["sessions"], []);
  queryClient.setQueryData(["app-passwords"], []);
  queryClient.setQueryData(["pgp-settings"], {
    publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\npreview\n-----END PGP PUBLIC KEY BLOCK-----",
    fingerprint: "1A2B 3C4D 5E6F 7788 9900 AABB CCDD EEFF 0011 2233",
    encryptedPrivateKey: "preview",
  });
  void installMessages();
}

const bodies: Record<string, string> = {
  "mail-1":
    "Hi Avery,\n\nHere are the notes for Thursday. The two open questions are the export format and who owns the migration checklist.\n\nI attached the draft agenda. Could you reply with anything you want added?\n\nThanks,\nMara",
  "mail-2":
    "Your encrypted export is ready to download from the dashboard. It stays available for 24 hours.",
  "mail-3": "Agreed on quiet defaults. Fewer switches, better choices out of the box.\n\nLin",
  "mail-4": "Thank you for travelling with us. Your receipt for Stockholm C is attached.",
  "mail-5": "A few things worth reading this weekend, in no particular order.",
};

async function installMessages() {
  const openpgp = await import("openpgp");
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: "Preview" }],
    format: "armored",
  });
  storeKeySession(me.userId, privateKey);
  const encryptionKeys = await openpgp.readKey({ armoredKey: publicKey });
  for (const email of emails) {
    const encryptedBody = (await openpgp.encrypt({
      message: await openpgp.createMessage({ text: bodies[email.id] ?? "" }),
      encryptionKeys,
    })) as string;
    const detail: EmailDetail = {
      id: email.id,
      mailboxId: email.id === "mail-1" ? "address-alias" : "address-primary",
      mailboxAddress: email.id === "mail-1" ? "quiet-forest@neirmail.com" : "avery@neir.io",
      senderName: email.senderName,
      senderAddress: email.senderAddress,
      recipientAddress:
        email.id === "mail-1" ? "quiet-forest@neirmail.com" : email.recipientAddress,
      ccAddresses: email.id === "mail-1" ? ["lin@field.example", "avery@neir.io"] : [],
      bccAddresses: [],
      subject: email.subject,
      encryptedBody,
      encryptedHtmlBody: null,
      messageId: `<${email.id}@preview.example>`,
      inReplyTo: null,
      references: [],
      isRead: email.isRead,
      isStarred: email.isStarred,
      isArchived: false,
      receivedAt: email.receivedAt,
      deliveryStatus: null,
      deliveryError: null,
      scheduledFor: null,
      openTrackingEnabled: false,
      openedAt: null,
      unsubscribeUrl: null,
      unsubscribeMailto: null,
      unsubscribeOneClick: false,
      attachments: email.hasAttachments
        ? [
            {
              id: `${email.id}-attachment`,
              fileName: email.id === "mail-1" ? "agenda-draft.pdf" : "receipt.pdf",
              sizeBytes: "184320",
              contentType: "application/pdf",
            },
          ]
        : [],
      isFirstTimeSender: email.id === "mail-4",
      lookalikeDomainWarning: null,
    };
    queryClient.setQueryData(["email", email.id], detail);
  }
}

function previewEmail(
  id: string,
  senderName: string | null,
  senderAddress: string,
  subject: string,
  isRead: boolean,
  hasAttachments = false,
): EmailListItem {
  return {
    id,
    senderName,
    senderAddress,
    recipientAddress: "avery@neir.io",
    subject,
    receivedAt: new Date(
      Date.now() - [0, 1, 2, 26, 75, 480][Number(id.charAt(id.length - 1))] * 3_600_000,
    ).toISOString(),
    isRead,
    isStarred: id === "mail-3",
    isPinned: id === "mail-2",
    hasAttachments,
    scheduledFor: null,
    openTrackingEnabled: false,
    openedAt: null,
  };
}
