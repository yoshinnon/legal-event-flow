import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getPool } from "../../shared/db";
import { ddb, TABLE } from "../../shared/dynamodb";
import { LegalDocumentEvent } from "../../shared/types";

const eb = new EventBridgeClient({});

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const path   = event.requestContext.http.path;
  const slug   = event.pathParameters?.slug ?? "";

  try {
    const pool = await getPool();

    // ── POST /documents/{slug}/versions ──────────────
    if (method === "POST" && path.endsWith("/versions")) {
      const body = JSON.parse(event.body ?? "{}");
      const { content, diffSummary, status = "published", applyAt } = body;

      if (!content) return response(400, { error: "content is required" });

      // 未来日時バリデーション
      if (applyAt !== undefined) {
        if (typeof applyAt !== "number" || applyAt <= Math.floor(Date.now() / 1000)) {
          return response(400, { error: "applyAt must be a future UNIX timestamp" });
        }
      }

      // document_id を slug から解決
      const docResult = await pool.query(
        "SELECT id FROM documents WHERE slug = $1",
        [slug]
      );
      if (docResult.rowCount === 0) return response(404, { error: "document not found" });
      const documentId = docResult.rows[0].id;

      if (!applyAt) {
        // 即時反映: Aurora に INSERT
        const versionResult = await pool.query(
          `INSERT INTO document_versions (document_id, content, diff_summary, status)
           VALUES ($1, $2, $3, $4) RETURNING id, version_number`,
          [documentId, content, diffSummary ?? null, status]
        );
        const { id: versionId, version_number } = versionResult.rows[0];

        // EventBridge にイベント発行
        const eventPayload: LegalDocumentEvent = {
          eventType:  "document.published",
          documentId,
          versionId,
          slug,
          timestamp: new Date().toISOString(),
        };
        await eb.send(new PutEventsCommand({
          Entries: [{
            EventBusName: process.env.EVENTBRIDGE_BUS_NAME,
            Source:       "legal-event-flow",
            DetailType:   "document.published",
            Detail:       JSON.stringify(eventPayload),
          }],
        }));

        return response(201, { versionId, versionNumber: version_number });
      } else {
        // 予約反映: DynamoDB に保存
        const updateId = randomUUID();
        await ddb.send(new PutCommand({
          TableName: TABLE.SCHEDULED_UPDATES,
          Item: {
            UpdateId:       updateId,
            ApplyAt:        applyAt,
            DocumentId:     documentId,
            PendingContent: content,
            Status:         "WAITING",
            ExpiresAt:      applyAt + 86400, // 反映後24時間でTTL
          },
        }));

        return response(202, { updateId, applyAt });
      }
    }

    // ── GET /documents ────────────────────────────────
    if (method === "GET" && path === "/documents") {
      const result = await pool.query(
        "SELECT id, slug, title, description, created_at, updated_at FROM documents ORDER BY created_at DESC"
      );
      return response(200, result.rows);
    }

    // ── GET /documents/{slug}/versions ───────────────
    if (method === "GET" && path.endsWith("/versions")) {
      const docResult = await pool.query("SELECT id FROM documents WHERE slug = $1", [slug]);
      if (docResult.rowCount === 0) return response(404, { error: "document not found" });

      const result = await pool.query(
        `SELECT id, version_number, diff_summary, status, created_at
         FROM document_versions WHERE document_id = $1
         ORDER BY version_number DESC`,
        [docResult.rows[0].id]
      );
      return response(200, result.rows);
    }

    // ── GET /documents/{slug} ─────────────────────────
    if (method === "GET" && slug) {
      const result = await pool.query(
        `SELECT d.id, d.slug, d.title, d.description, d.updated_at,
                v.id AS version_id, v.version_number, v.content, v.diff_summary, v.status, v.created_at
         FROM documents d
         JOIN document_versions v ON v.document_id = d.id
         WHERE d.slug = $1 AND v.status = 'published'
         ORDER BY v.version_number DESC
         LIMIT 1`,
        [slug]
      );
      if (result.rowCount === 0) return response(404, { error: "document not found" });
      return response(200, result.rows[0]);
    }

    return response(404, { error: "Not found" });

  } catch (err) {
    console.error("api-handler error:", err);
    return response(500, { error: "Internal server error" });
  }
};
