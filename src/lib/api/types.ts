export interface ApiErrorShape {
  status: number;
  code?: string | null;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code?: string | null;

  constructor(shape: ApiErrorShape) {
    super(shape.message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = shape.status;
    this.code = shape.code;
  }

  static fromUnknown(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    return new ApiError(normalizeApiError(error));
  }
}

export function normalizeApiError(error: unknown): ApiErrorShape {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { status: 0, message: error.message || "The request could not be completed." };
  }
  if (typeof error === "string") {
    const message = error.trim();
    if (!message) return fallbackApiError();
    try {
      return normalizeApiError(JSON.parse(message) as unknown);
    } catch {
      return { status: 0, message };
    }
  }
  if (isRecord(error)) {
    const nested = error.error;
    if (nested !== undefined && !hasErrorFields(error)) return normalizeApiError(nested);

    const status =
      typeof error.status === "number" && Number.isFinite(error.status) && error.status >= 0
        ? Math.trunc(error.status)
        : 0;
    const code = typeof error.code === "string" ? error.code : null;
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "The request could not be completed.";
    return { status, code, message };
  }
  return fallbackApiError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasErrorFields(value: Record<string, unknown>): boolean {
  return "status" in value || "code" in value || "message" in value;
}

function fallbackApiError(): ApiErrorShape {
  return { status: 0, message: "The request could not be completed." };
}

export type LoginOutcome =
  { status: "authenticated" } | { status: "requires_2fa"; preAuthToken: string };

export interface Me {
  userId: string;
  displayName: string | null;
  plan: "free" | "pro";
  storageQuotaBytes: number;
  status: string;
  isAdmin: boolean;
  sendingEnabled: boolean;
  twofaActive: boolean;
}

export interface PgpSettings {
  publicKey: string;
  fingerprint: string;
  encryptedPrivateKey: string | null;
}

export type FolderType =
  "inbox" | "sent" | "drafts" | "archive" | "starred" | "spam" | "trash" | "custom";

export interface Folder {
  id: string;
  name: string;
  type: FolderType;
  iconClass: string | null;
  unreadCount: number;
  totalCount: number;
}

export type NavKind =
  "inbox" | "starred" | "sent" | "drafts" | "spam" | "archive" | "trash" | "folder";

export interface EmailListItem {
  id: string;
  senderName: string | null;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  isPinned: boolean;
  hasAttachments: boolean;
  scheduledFor: string | null;
  openTrackingEnabled: boolean;
  openedAt: string | null;
}

export interface EmailListResult {
  emails: EmailListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailAttachmentInfo {
  id: string;
  fileName: string;
  sizeBytes: string;
  contentType: string;
  encrypted?: boolean;
}

export interface EmailDetail {
  id: string;
  mailboxId: string;
  mailboxAddress: string;
  senderName: string | null;
  senderAddress: string;
  recipientAddress: string;
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  encryptedBody: string;
  encryptedHtmlBody: string | null;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  receivedAt: string;
  deliveryStatus: string | null;
  deliveryError: string | null;
  scheduledFor: string | null;
  openTrackingEnabled: boolean;
  openedAt: string | null;
  unsubscribeUrl: string | null;
  unsubscribeMailto: string | null;
  unsubscribeOneClick: boolean;
  attachments: EmailAttachmentInfo[];
  isFirstTimeSender: boolean | null;
  lookalikeDomainWarning: string | null;
}

export type BatchActionType =
  "move" | "read" | "unread" | "star" | "unstar" | "trash" | "archive" | "unarchive";

export interface BatchActionResult {
  id: string;
  previous: { folderId: string; isRead: boolean; isStarred: boolean; isArchived: boolean };
}

export interface ComposeFields {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  htmlBody?: string;
  inReplyTo?: string;
  draftId?: string;
  scheduledFor?: string;
  fromMailboxId?: string;
  keepAttachmentIds?: string;
}

export interface SessionSummary {
  id: string;
  device: string;
  isMobile: boolean;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface AppPasswordSummary {
  id: string;
  clientName: string;
  createdAt: string;
}

export interface AppPasswordCreated extends AppPasswordSummary {
  plaintext: string;
}

export interface Preferences {
  displayName: string | null;
  autoDeleteReadEmailsDays: number | null;
  autoDeleteInactiveAccountEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  trackEmailOpens: boolean;
  compactViewEnabled: boolean;
  lightModeEnabled: boolean;
  stripImageMetadataEnabled: boolean;
  stripDocumentMetadataEnabled: boolean;
  stripTrackingParamsEnabled: boolean;
  firstTimeSenderWarningEnabled: boolean;
  lookalikeDomainWarningEnabled: boolean;
  autoSignOutgoingEmail: boolean;
}

export type UpdatePreferencesInput = Partial<Preferences>;

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  setupToken: string;
}

export interface PaymentOption {
  currency: string;
  name: string;
  network: string;
  networkName: string;
  confirmations: number | null;
}

export interface PaymentOptionsResult {
  prices: Array<{ months: 1 | 3 | 6 | 12; usdAmount: string }>;
  options: PaymentOption[];
}

export interface PaymentCheckout {
  id: string;
  token: string;
  status: "waiting" | "received" | "underpaid" | "confirming" | "paid" | "expired" | "failed";
  months: 1 | 3 | 6 | 12;
  usdAmount: string;
  payCurrency: string;
  network: string;
  payAmount: string;
  address: string;
  paymentUri: string;
  expiresAt: string;
  paidAt?: string | null;
}

export interface AccountSummary {
  userId: string;
  displayName: string | null;
  status: string;
  primaryAddress: string | null;
  aliases: Array<{ id: string; address: string; createdAt: string }>;
  storageQuotaBytes: string;
  usedBytes: string;
}

export interface AccountActivity {
  type: "sign_in" | "alias_added" | "primary_address_created";
  timestamp: string;
  detail: string;
}

export interface MailboxAddress {
  id: string;
  address: string;
  type: "primary" | "alias";
  catchAll: boolean;
  isRandomAlias: boolean;
  createdAt: string;
}

export type FilterField = "from" | "subject" | "body" | "attachment";
export type FilterMatchType = "contains" | "exact" | "startsWith" | "endsWith";
export type FilterAction = "star" | "archive" | "trash" | "move" | "markRead" | "deletePermanently";

export interface EmailFilter {
  id: string;
  field: FilterField;
  matchType: FilterMatchType;
  matchValue: string | null;
  action: FilterAction;
  destinationFolderId: string | null;
  order: number;
  createdAt: string;
}

export interface CreateFilterInput {
  field: FilterField;
  matchType?: FilterMatchType;
  matchValue?: string;
  action: FilterAction;
  destinationFolderId?: string;
}

export interface Contact {
  id: string;
  displayName: string;
  email: string;
  pgpPublicKey: string | null;
  createdAt: string;
}

export type SenderIconSource = "bimi" | "favicon";
