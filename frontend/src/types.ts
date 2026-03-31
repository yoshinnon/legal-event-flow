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

export interface ScheduledUpdate {
  updateId:       string;
  documentId:     string;
  applyAt:        number;   // UNIX Timestamp
  pendingContent: string;
  status:         "WAITING" | "EXECUTED" | "FAILED";
}

export interface PublishPayload {
  content:     string;
  diffSummary: string;
  status:      "published";
  applyAt?:    number;
}
