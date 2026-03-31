import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Document, DocumentVersion } from "../types";

interface UseDocumentResult {
  document:       Document | null;
  currentVersion: DocumentVersion | null;
  isLoading:      boolean;
  error:          string | null;
  refetch:        () => void;
}

export function useDocument(slug: string): UseDocumentResult {
  const [document,       setDocument]       = useState<Document | null>(null);
  const [currentVersion, setCurrentVersion] = useState<DocumentVersion | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDocument(slug) as Document & {
        version_id: string; version_number: number;
        content: string; diff_summary: string | null;
        status: "draft" | "published";
      };
      setDocument({
        id:          data.id,
        slug:        data.slug,
        title:       data.title,
        description: data.description,
        createdAt:   data.createdAt ?? (data as any).created_at,
        updatedAt:   data.updatedAt ?? (data as any).updated_at,
      });
      setCurrentVersion({
        id:            data.version_id,
        documentId:    data.id,
        versionNumber: data.version_number,
        content:       data.content,
        diffSummary:   data.diff_summary,
        status:        data.status,
        createdAt:     data.createdAt ?? (data as any).created_at,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetch(); }, [fetch]);

  return { document, currentVersion, isLoading, error, refetch: fetch };
}
