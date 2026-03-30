# Claude Code 指示書：Legal-Event-Flow (Serverless Version)

## プロジェクト概要

法務ドキュメント（利用規約等）の変更をトリガーに、イベント駆動で複数のワークフロー（通知・DB更新・静的サイト反映）を自動実行するWebアプリ。ITエンジニアとしての技術力アピール用ポートフォリオ。

## 確定技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React (Vite) + TypeScript + Tailwind CSS |
| Backend | AWS Lambda (Node.js/TypeScript) |
| IaC | Terraform v1.5+ |
| メインDB | Aurora Serverless v2 (PostgreSQL互換) |
| 設定・予約DB | DynamoDB |
| イベントバス | EventBridge + SQS（MSKの代替：コスト最適化） |
| ホスティング | S3 + CloudFront |
| 秘匿情報管理 | Secrets Manager |
| DBマイグレーション | node-postgres + SQLファイル直接実行（専用Lambda） |
| CI/CD | GitHub Actions（OIDC認証） |

---

## ディレクトリ構成

```
legal-event-flow/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # main push時の全体デプロイ
│       └── terraform.yml       # Terraform plan/apply
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── backend.tf              # S3 remote state
│   ├── modules/
│   │   ├── vpc/
│   │   ├── aurora/
│   │   ├── dynamodb/
│   │   ├── sqs/
│   │   ├── eventbridge/
│   │   ├── lambda/
│   │   ├── apigateway/
│   │   ├── s3_cloudfront/
│   │   └── iam/
├── backend/
│   ├── src/
│   │   ├── api-handler/        # Lambda: APIリクエスト処理
│   │   │   └── index.ts
│   │   ├── scheduler-handler/  # Lambda: 予約反映（EventBridge起動）
│   │   │   └── index.ts
│   │   ├── consumer-handler/   # Lambda: SQSイベント処理
│   │   │   └── index.ts
│   │   └── migrate-handler/    # Lambda: Aurora マイグレーション専用
│   │       └── index.ts
│   ├── migrations/             # SQLマイグレーションファイル（連番管理）
│   │   ├── 001_initial.sql     # documents / document_versions テーブル
│   │   └── 002_seed.sql        # 初期データ投入（任意）
│   ├── shared/
│   │   ├── db.ts               # Aurora接続ユーティリティ
│   │   ├── dynamodb.ts         # DynamoDB操作ユーティリティ
│   │   └── types.ts            # 共通型定義
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── AdminPage.tsx   # /admin: 差分確認エディタ
    │   │   └── TermsPage.tsx   # /terms: 一般公開ページ
    │   ├── components/
    │   ├── api/
    │   │   └── client.ts       # APIクライアント（fetch wrapper）
    │   └── main.tsx
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── package.json
```

---

## Task 1: Terraform 基礎構築

**指示文：**

```
/terraform ディレクトリを作成し、以下のリソースをモジュール分割して定義してください。

### 必須リソース

1. **S3バックエンド（state管理）**
   - backend.tf に S3 remote state の設定を記述
   - バケット名は変数化する

2. **VPC**
   - Public Subnet × 2（異なるAZ）
   - Private Subnet × 2（異なるAZ）
   - Internet Gateway、NAT Gateway
   - Aurora・Lambda用のセキュリティグループ

3. **Aurora Serverless v2（PostgreSQL互換）**
   - エンジン: aurora-postgresql、最新安定バージョン
   - min_capacity: 0.5 ACU、max_capacity: 4 ACU（コスト最適化）
   - DB Subnet Group はPrivate Subnetに配置
   - 認証情報はSecrets Managerに自動生成・保存
   - テーブル定義（初期マイグレーション）は別ファイルに記載
   - **`skip_final_snapshot = !var.is_production`**（開発時はスナップショットなし即削除）
   - **`deletion_protection = var.is_production`**（開発時はterraform destroyで即削除可能）

4. **DynamoDB（5テーブル）**

   **テーブル1: `ScheduledUpdates`（予約反映管理）**
   - PK: `UpdateId` (S) — UUID
   - 属性: `ApplyAt` (N, UNIX Timestamp)、`DocumentId` (S)、`PendingContent` (S)、`Status` (S: WAITING / EXECUTED / FAILED)
   - GSI: `ApplyAt-index`（PK: `ApplyAt` (N)）← scheduler-handlerが時刻範囲でクエリするために必須
   - TTL属性: `ExpiresAt` (N)
   - billing_mode: PAY_PER_REQUEST
   - **`deletion_protection_enabled = false`**（明示してterraform destroyで確実に削除）

   **テーブル2: `UserSettings`（通知設定）**
   - PK: `UserId` (S)
   - 属性: 通知有効フラグ等
   - billing_mode: PAY_PER_REQUEST

   **テーブル3: `IdempotencyKeys`（二重処理防止）**
   - PK: `MessageId` (S) — SQSメッセージID
   - 属性: `ProcessedAt` (S)
   - TTL属性: `TTL` (N) — 処理後24時間で自動削除
   - billing_mode: PAY_PER_REQUEST

   **テーブル4: `SchemaMigrations`（マイグレーション履歴）**
   - PK: `Version` (S)（例: "001"）
   - 属性: `AppliedAt` (S)、`Description` (S)
   - billing_mode: PAY_PER_REQUEST
   - 理由: Auroraにmigration管理テーブルを置くと鶏卵問題が生じるためDynamoDBで管理

   **テーブル5: `UserSettings`は上記テーブル2と統合済み（重複なし）**

5. **SQS**
   - キュー名: `legal-document-events`
   - デッドレターキュー（DLQ）も作成（maxReceiveCount: 3）
   - メッセージ保持期間: 1日

6. **EventBridge**
   - ルール1: api-handlerからのイベントをSQSにルーティング
   - ルール2: cron(0 * * * ? *) でscheduler-handlerを起動（毎時）

7. **Lambda（4関数）**
   - api-handler: API GatewayからのHTTPリクエストを処理
   - scheduler-handler: EventBridgeで起動、DynamoDB予約データを確認しSQSへ発行
   - consumer-handler: SQSトリガーで起動、通知処理とS3アーカイブを実行
   - migrate-handler: GitHub ActionsからAurora SQLマイグレーションを実行する専用Lambda
     - VPC内配置（Auroraと同じPrivate Subnet）
     - 実行後は正常終了/失敗をCloudWatch Logsに記録
   - 共通設定: runtime nodejs20.x、timeout 30秒（migrate-handlerのみ300秒）、VPC内配置
   - 環境変数: DB接続情報（Secrets ManagerのARN）、SQS URL、DynamoDBテーブル名

8. **API Gateway（HTTP API）**
   - `POST /documents/{slug}/versions` — 新バージョン投稿（即時 or 予約）
   - `GET  /documents` — ドキュメント一覧
   - `GET  /documents/{slug}` — 指定slugの最新publishedバージョン取得
   - `GET  /documents/{slug}/versions` — 全バージョン履歴一覧
   - CORS設定あり（フロントエンドのCloudFrontドメインを許可）

9. **S3 + CloudFront**
   - S3: Reactビルド成果物の格納（パブリックアクセスブロック）
   - **`force_destroy = true`** — オブジェクトが残っていてもterraform destroyで一括削除
   - CloudFront: OAC（Origin Access Control）でS3アクセス
   - SPA対応: 403/404 → index.html にリダイレクト
   - **注意**: CloudFrontの設定がエッジから完全に消えるまで数分〜数十分かかる場合がある（terraform destroy自体はすぐ完了）

10. **IAMロール（OIDC）**
    - GitHub Actions用ロール
    - 許可: S3デプロイ、CloudFrontキャッシュ無効化、Lambda更新、Terraform実行
    - OIDCプロバイダーのthumbprintは自動取得

### 変数（variables.tf）— パラメータシート

以下をすべて `variables.tf` に定義し、リソース設定を中央管理すること。

| カテゴリ | 変数名 | 型 | 推奨値(Dev) | 説明 |
|---|---|---|---|---|
| 全般 | `project_name` | string | `"legal-event-flow"` | 全リソース名の接頭辞 |
| 全般 | `environment` | string | `"dev"` | `dev` / `prod` で切り替え |
| 全般 | `is_production` | bool | `false` | 削除保護・スナップショット制御フラグ |
| AWS | `aws_region` | string | `"ap-northeast-1"` | 東京リージョン |
| AWS | `github_repo` | string | `"username/legal-event-flow"` | OIDC用リポジトリ名 |
| RDS | `db_min_acu` | number | `0.5` | Aurora v2 最小容量（コスト抑制） |
| RDS | `db_max_acu` | number | `4` | Aurora v2 最大容量 |
| RDS | `skip_final_snapshot` | bool | `true` | destroy時のバックアップスキップ |
| Logs | `log_retention_days` | number | `7` | CloudWatch Logs保持日数（無期限を避ける） |
| S3 | `force_destroy` | bool | `true` | バケット削除時に中身も強制削除 |

**`local.common_tags`（locals.tf）も定義すること:**
```hcl
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  # リソース名プレフィックス（全リソースで統一）
  name_prefix = "${var.project_name}-${var.environment}"
}
```

全リソースの `name` / `Name` タグに `local.name_prefix` を使用し、
`terraform destroy` 後に孤立リソースが残った場合でも判別しやすくすること。
```

---

## Task 2: React フロントエンド

**指示文：**

```
/frontend ディレクトリにReact (Vite + TypeScript + Tailwind CSS) の管理画面を作成してください。

### デザイン方針
- シンプル・プロフェッショナルなUIを目指す
- カラーパレット: ダークネイビー基調（法務・信頼感）
- Google Fonts: Noto Sans JP（日本語対応）

### ページ1: /admin（管理画面）

機能要件:
- テキストエリアで新バージョンのMarkdownを入力
- `react-diff-viewer-continued` を使って旧バージョンとの差分をサイドバイサイド表示
- 「確定」ボタン押下時に以下のモーダルを表示：
  - 選択肢A: 即時反映（POST /documents を即時呼び出し）
  - 選択肢B: 日時指定（datetime-local inputで日時選択 → DynamoDB保存）
- API呼び出し中はローディングスピナー表示
- 成功/失敗のトースト通知

### ページ2: /terms（一般公開ページ）

機能要件:
- GET /documents/latest でAuroraから最新の利用規約Markdownを取得
- `react-markdown` + `remark-gfm` でレンダリング
- バージョン番号と最終更新日を表示
- ローディング・エラー状態のハンドリング

### ルーティング
- react-router-dom v6 を使用
- / → /terms にリダイレクト

### API クライアント（src/api/client.ts）
- ベースURLは環境変数 VITE_API_ENDPOINT から取得
- fetch wrapper（エラーハンドリング込み）
- リクエスト/レスポンスの型定義をsrc/types.tsで管理

### 型定義（共通 — src/types.ts）
```typescript
interface Document {
  id: string;
  slug: string;           // 'terms-of-service' など
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;  // SERIAL（自動採番）
  content: string;        // Markdown本文
  diffSummary: string | null;
  status: 'draft' | 'published';
  createdAt: string;
}

interface ScheduledUpdate {
  updateId: string;
  documentId: string;
  applyAt: number;        // UNIX Timestamp (Number型)
  pendingContent: string;
  status: 'WAITING' | 'EXECUTED' | 'FAILED';
}
```

### ページ1: /admin（管理画面）追加仕様

- `applyAt` を日時指定する際は `<input type="datetime-local">` の値を **UNIX Timestamp（ミリ秒→秒に変換）** してAPIに送信
- 過去日時を選択した場合はボタンをdisabledにしてクライアント側でも弾く
- `status` を `draft` / `published` で選択できるトグルを追加（デフォルト: published）
```

---

## Task 3: Lambda バックエンド

**指示文：**

```
/backend ディレクトリにLambda関数3つをTypeScriptで実装してください。
ビルドツール: esbuild（各関数を単一JSファイルにバンドル）

### 共通設定
- tsconfig.json: target ES2022、module commonjs
- package.json scripts:
  - build: esbuildで各entrypointをdist/以下にバンドル
  - test: jest
- 依存パッケージ: @aws-sdk/client-sqs, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-secrets-manager, pg（PostgreSQLドライバ）

### Lambda 1: api-handler

エンドポイント処理:

POST /documents/{slug}/versions
- リクエストボディ: `{ content: string, diffSummary?: string, status?: 'draft'|'published', applyAt?: number }`
- **バリデーション（applyAt指定時）**:
  - `applyAt` が現在時刻より未来であることを確認
  - 過去日時の場合は HTTP 400 + `{ error: "applyAt must be a future UNIX timestamp" }` を返す
- applyAtがない場合（即時反映）:
  1. Aurora `document_versions` に `status='published'` で新バージョンを挿入
  2. EventBridgeに `document.published` イベントを発行
  3. 成功レスポンス返却
- applyAtがある場合（予約）:
  1. **未来日時バリデーション通過後**、DynamoDB `ScheduledUpdates` に保存
     - UpdateId=UUID、ApplyAt=UNIX Timestamp (Number)、Status='WAITING'
  2. 成功レスポンス返却

GET /documents
- Aurora `documents` 全件を返す（slug, title, description, created_at）

GET /documents/{slug}
- Aurora `documents` + 最新 `published` バージョンを JOIN して返す

GET /documents/{slug}/versions
- Aurora `document_versions` の全バージョン一覧を返す（本文除く）

### Lambda 2: scheduler-handler

EventBridgeで毎時起動:
1. DynamoDB `ScheduledUpdates` の **GSI `ApplyAt-index`** をクエリ
   - 条件: `ApplyAt <= 現在のUNIX Timestamp` かつ `Status = 'WAITING'`
   - スキャンではなくGSIクエリで効率的に取得（フルスキャン禁止）
2. 各レコードをEventBridgeに `document.scheduled_publish` イベントとして発行
3. 発行成功後、DynamoDB の `Status` を `EXECUTED` に更新（削除はしない・履歴保持）

### Lambda 3: consumer-handler

SQSトリガー（バッチサイズ: 10）:

冪等性の担保:
- メッセージIDをDynamoDB **`IdempotencyKeys`** テーブルで管理
- 処理済みIDの場合はスキップ（重複処理防止）

イベントタイプ別処理:
- `document.published` または `document.scheduled_publish`:
  1. S3にJSONアーカイブを保存（`logs/{YYYY-MM-DD}/{messageId}.json`）
  2. `UserSettings` テーブルから通知設定ユーザーを取得
  3. コンソールログで通知をモック出力（実際のメール送信は未実装）
  4. 処理済みIDを `IdempotencyKeys` テーブルに記録（TTL=処理時刻+86400秒）

エラーハンドリング:
- 個別メッセージの失敗はDLQに送る（SQSのbatchItemFailures形式で返す）

### shared/db.ts（Aurora接続）
- Secrets Managerから認証情報を取得（起動時1回キャッシュ）
- pgのPool接続（max: 5）
- Lambda環境でのコネクションリーク対策（keepAlive設定）

### Lambda 4: migrate-handler

GitHub ActionsからInvokeされる専用マイグレーションLambda:

処理フロー:
1. Secrets ManagerからAurora認証情報を取得しDB接続
2. DynamoDB **`SchemaMigrations`** テーブルから適用済みバージョン一覧を取得
3. `/migrations/*.sql` ファイルを連番順にスキャン（Lambdaパッケージに同梱）
4. 未適用のSQLファイルのみトランザクション内で実行
5. 成功したバージョンを `schema_migrations` テーブルに記録（AppliedAt=NOW()）
6. 全バージョンが適用済みの場合は「No migrations to apply」を返して正常終了

冪等性:
- 同じバージョンを2回実行しても2回目はスキップ（DynamoDBの適用済みフラグで制御）
- SQLファイルは `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` で記述

エラーハンドリング:
- 1つのSQLファイルが失敗したらロールバックし、後続ファイルの実行を中止
- エラー内容をCloudWatch Logsに詳細出力し、GitHub Actionsに失敗を伝播
```

---

## Task 4: GitHub Actions CI/CD

**指示文：**

```
/.github/workflows/deploy.yml を作成してください。

### トリガー
- mainブランチへのpush

### 環境変数（GitHub Secretsから取得）
- AWS_ACCOUNT_ID
- AWS_REGION（デフォルト: ap-northeast-1）
- TF_STATE_BUCKET（Terraform state用S3バケット名）
- CLOUDFRONT_DISTRIBUTION_ID
- VITE_API_ENDPOINT（API GatewayのエンドポイントURL）

### ジョブ構成

#### Job 1: terraform
- uses: aws-actions/configure-aws-credentials（OIDC認証）
- role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-role
- terraform init → plan → apply（自動承認）
- working-directory: ./terraform

#### Job 2: deploy-backend（needs: terraform）
- npm ci && npm run build（/backend）
- Lambda関数ごとにzipして aws lambda update-function-code を実行：
  - api-handler
  - scheduler-handler
  - consumer-handler
  - migrate-handler（migrations/*.sql を同梱してzip）

#### Job 3: migrate（needs: deploy-backend）
- migrate-handler Lambdaを同期Invokeで実行：
  ```
  aws lambda invoke \
    --function-name legal-event-flow-migrate-handler \
    --invocation-type RequestResponse \
    --log-type Tail \
    response.json
  ```
- response.jsonの内容をログ出力
- 終了コードが0以外なら後続Jobを停止

#### Job 4: deploy-frontend（needs: terraform）
- Job 2・3とは独立して並列実行可能（ReactビルドはDB不要）
- npm ci && npm run build（/frontend）
  - 環境変数 VITE_API_ENDPOINT をビルド時に注入
- aws s3 sync dist/ s3://{バケット名} --delete
- aws cloudfront create-invalidation --paths "/*"

### 実行順序まとめ
```
terraform ──┬──> deploy-backend ──> migrate
            └──> deploy-frontend
```

### 注意点
- Job 3（migrate）はJob 2完了後に実行（最新コードが確実にデプロイされた後）
- Job 4はJob 1完了後すぐ並列実行（DBに依存しないため）
- キャッシュ: npm依存関係をactions/cacheでキャッシュ（node_modules）
```

---

## Aurora マイグレーションファイル設計

マイグレーション履歴はDynamoDB（`schema_migrations`）で管理し、Auroraには管理テーブルを置かない（鶏卵問題の回避）。

```sql
-- /backend/migrations/001_initial.sql
-- 必ず IF NOT EXISTS を使い冪等性を保証すること

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(50)  UNIQUE NOT NULL,  -- 'terms-of-service' など URL識別子
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number SERIAL,                         -- 自動インクリメント（手動採番不要）
  content        TEXT NOT NULL,                  -- Markdown本文
  diff_summary   TEXT,                           -- 前バージョンとの差分要約（AI生成枠）
  status         VARCHAR(20) DEFAULT 'published' -- 'draft' | 'published'
                   CHECK (status IN ('draft', 'published')),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id
  ON document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_doc_versions_status_created
  ON document_versions(document_id, status, created_at DESC);
```

```sql
-- /backend/migrations/002_seed.sql
-- 動作確認用の初期ドキュメント（冪等: 重複時はスキップ）

INSERT INTO documents (id, slug, title, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'terms-of-service',
  '利用規約',
  'サービス利用に関する規約'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (document_id, content, diff_summary, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '# 利用規約

本サービスをご利用の前に、以下の利用規約をお読みください。',
  '初版作成',
  'published'
)
ON CONFLICT (document_id, version_number) DO NOTHING;
```

---

## Task 5: terraform destroy 完全削除設計

**指示文：**

```
Terraformコード全体に以下の「完全削除設計」を適用してください。
`is_production = false`（デフォルト）の状態で `terraform destroy` を実行したとき、
手動介入なしにすべてのリソースが削除されることを目標とします。

### リソース別の設定

#### S3バケット（全バケット共通）
force_destroy = true を必ず設定すること。
対象: 静的ホスティング用バケット、Terraform state用バケット、ログアーカイブ用バケット

#### Aurora（aws_rds_cluster）
skip_final_snapshot = !var.is_production
deletion_protection  = var.is_production
→ is_production=false なら即削除、true なら削除保護ON

#### DynamoDB（全テーブル共通）
deletion_protection_enabled = false を明示的に設定（デフォルトfalseだが明示で意図を伝える）

#### CloudWatch Logs（ロググループ）
LambdaのロググループはTerraformで明示的に定義し、terraform destroyで一緒に消えるようにする。

resource "aws_cloudwatch_log_group" "lambda_api_handler" {
  name              = "/aws/lambda/${var.project_name}-api-handler"
  retention_in_days = 7          # コスト最適化（開発中は7日で十分）
  tags              = local.common_tags
}

# scheduler-handler, consumer-handler, migrate-handler も同様に定義

→ Lambdaが自動生成するロググループに頼らず、Terraformで管理することで
  terraform destroy 時に確実に削除される

#### Secrets Manager（aws_secretsmanager_secret）
recovery_window_in_days = 0
→ デフォルトは30日間の「削除猶予期間」があり、その間は再作成できない。
  0を設定することで即時削除（強制削除）が可能になる。
  ただしis_productionフラグと連動させる:
  recovery_window_in_days = var.is_production ? 30 : 0

### `is_production` フラグの使い方

# variables.tf
variable "is_production" {
  description = "本番環境フラグ。falseの場合はterraform destroyで全リソースを即削除可能にする"
  type        = bool
  default     = false
}

# GitHub Actionsでの切り替え例（本番デプロイ時）:
# terraform apply -var="is_production=true"

### terraform destroy 後の手動作業（残るもの）

以下はTerraformの管理外であるため、必要に応じて手動削除する:
1. Terraform stateバケット自体（is_productionをfalseにしてforce_destroy=trueにしてあるが
   stateバケットだけは最後に手動削除が安全）
2. CloudFrontのエッジキャッシュ（destroy完了後も数十分は残る場合がある）
3. IAMのOIDCプロバイダー（他のリポジトリと共有している場合は残しておくこと）

→ README.md の「環境削除手順」セクションに上記の注意を記載すること
```

---

## CloudWatch Logs 管理

**指示文：**

```
CloudWatch Logsをすべてのリソースに対してTerraformで明示的に定義してください。
Lambdaが自動生成するロググループには頼らず、Terraform管理下に置くことで
terraform destroy 時に確実に削除されるようにします。

### ロググループ定義（全Lambda共通パターン）

以下の4つのLambda関数それぞれに aws_cloudwatch_log_group を定義する:
- /aws/lambda/${var.project_name}-${var.environment}-api-handler
- /aws/lambda/${var.project_name}-${var.environment}-scheduler-handler
- /aws/lambda/${var.project_name}-${var.environment}-consumer-handler
- /aws/lambda/${var.project_name}-${var.environment}-migrate-handler

共通設定:
  retention_in_days = var.log_retention_days  # variables.tfから取得（推奨値: 7日）
  tags              = local.common_tags

### Aurora 監査ログ（オプション）

aws_rds_cluster の enabled_cloudwatch_logs_exports に "postgresql" を設定し、
対応するロググループ /aws/rds/cluster/${var.project_name}-${var.environment}/postgresql も
Terraformで定義する（retention_in_days = var.log_retention_days）

### API Gateway アクセスログ（オプション）

aws_apigatewayv2_stage の access_log_settings に以下のロググループを設定:
  /aws/apigateway/${var.project_name}-${var.environment}
  retention_in_days = var.log_retention_days

### Lambdaリソースとロググループの依存関係

Lambda関数定義に depends_on = [aws_cloudwatch_log_group.xxx] を付けること。
これにより「ロググループ作成 → Lambda作成」の順序が保証され、
Lambdaが自動生成ロググループを作る前にTerraform管理のロググループが存在する状態になる。

### 削除時の動作確認

terraform destroy 実行時の削除順序（Terraform が自動解決）:
  1. Lambda関数（depends_on でロググループに依存）
  2. CloudWatch Logsロググループ
  3. その他リソース（VPC, Aurora, DynamoDB等）
```

---

Claude Codeに `/README.md` も生成させる際に以下を含めること：

1. **イベント駆動アーキテクチャ**: EventBridge + SQSによる疎結合設計
2. **冪等性の実装**: DynamoDB `IdempotencyKeys` テーブルによるSQSメッセージ重複防止・TTL自動削除
3. **IaCの完全性**: Terraform moduleによる再現可能なインフラ。DynamoDBのGSI設定・TTLもTerraformで管理
4. **スキーマ自動化**: migrate-handler Lambdaによる完全自動マイグレーション。履歴を `SchemaMigrations`（DynamoDB）で管理（鶏卵問題を回避）
5. **バリデーション設計**: 予約日時の未来日時チェックをAPIとフロントエンドの両レイヤーで実施
6. **コスト最適化**: Aurora v2の最小スケール（0.5 ACU）、SQSによるMSKからの置き換え、DynamoDB PAY_PER_REQUEST
7. **セキュリティ**: OIDC認証によるシークレットレスCI/CD、Secrets Managerによる認証情報管理・自動ローテーション
8. **型安全性**: フロント・バックエンドともにTypeScriptで統一。Aurora・DynamoDB両方の型定義を共有

---

## Claude Codeへの最初のプロンプト（コピペ用）

```
この指示書（claude_code_instructions.md）に従い、以下の順番で実装してください。

Step 1: プロジェクトのルートディレクトリ構成を作成し、各ディレクトリのREADME.mdを配置
Step 2: /terraform を実装（Task 1 + Task 5 + CloudWatch Logs管理 + パラメータシートの内容）。
        まず variables.tf と locals.tf（name_prefix, common_tags）を作成してから各モジュールに進む。
        VPC・S3バックエンド → Aurora・DynamoDB（4テーブル）→ SQS・EventBridge
        → Lambda（4関数）+ CloudWatch Logsロググループ（depends_on付き）→ API Gateway・CloudFront の順に進める。
        is_productionフラグによる削除保護の切り替えをすべてのリソースに適用すること。
Step 3: /backend を実装（Task 3の内容）。shared/db.ts → migrations/SQLファイル
        → migrate-handler → api-handler → scheduler-handler → consumer-handler の順に実装
Step 4: /frontend を実装（Task 2の内容）
Step 5: /.github/workflows を実装（Task 4の内容）。
        terraform → deploy-backend → migrate → deploy-frontend の4ジョブ構成にすること
Step 6: プロジェクトルートにREADME.mdを生成。
        アーキテクチャ図・セットアップ手順・環境削除手順（terraform destroy後の手動作業含む）
        ・アピールポイントを含めること

各Stepが完了したら確認を取ってから次に進んでください。
```
