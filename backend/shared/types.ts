// ── Aurora 型定義 ────────────────────────────────
export interface Document {
  id:          string;
  slug:        string;
  title:       string;
  description: string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface DocumentVersion {
  id:            string;
  documentId:    string;
  versionNumber: number;
  content:       string;
  diffSummary:   string | null;
  status:        "draft" | "published";
  createdAt:     string;
}

// ── DynamoDB 型定義 ──────────────────────────────
export interface ScheduledUpdate {
  UpdateId:       string;
  ApplyAt:        number;   // UNIX Timestamp
  DocumentId:     string;
  PendingContent: string;
  Status:         "WAITING" | "EXECUTED" | "FAILED";
  ExpiresAt?:     number;
}

export interface IdempotencyKey {
  MessageId:   string;
  ProcessedAt: string;
  TTL:         number;
}

// ── イベント型 ────────────────────────────────────
export type EventType = "document.published" | "document.scheduled_publish";

export interface LegalDocumentEvent {
  eventType:  EventType;
  documentId: string;
  versionId:  string;
  slug:       string;
  timestamp:  string;
}
