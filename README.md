# Legal Event Flow

法務ドキュメントの変更をトリガーに、イベント駆動で通知・DB更新・静的サイト反映を自動実行するサーバーレスWebアプリ。

## Architecture

- **Frontend**: React (Vite) + TypeScript + Tailwind CSS → S3 + CloudFront
- **Backend**: AWS Lambda (Node.js/TypeScript) × 4関数
- **Event Bus**: EventBridge + SQS（疎結合・冪等性保証）
- **DB**: Aurora Serverless v2 (PostgreSQL) + DynamoDB
- **IaC**: Terraform（全リソース管理）
- **CI/CD**: GitHub Actions（OIDC認証）

## Configration Diagram
![diagram](images/diagram.jpg)

## Getting Started

### 前提条件
- AWS CLI 設定済み
- Terraform v1.7+
- Node.js v20+

### 初回セットアップ

```bash
# 1. Terraform state 用 S3 バケットを手動作成（一度だけ）
aws s3 mb s3://your-tf-state-bucket --region ap-northeast-1

# 2. インフラ構築
cd terraform
terraform init -backend-config="bucket=your-tf-state-bucket"
terraform apply -var="github_repo=your-org/legal-event-flow"

# 3. フロントエンド開発
cd frontend && npm install && npm run dev
```

### 環境削除

```bash
cd terraform && terraform destroy
# ⚠️  terraform state バケット自体は手動削除が必要
# ⚠️  CloudFront のエッジキャッシュ消去に数十分かかる場合あり
```

## CI/CD

`main` ブランチへの push で以下が自動実行されます:

```
terraform apply
  ↓
Lambda デプロイ (4関数)
  ↓
DB マイグレーション (migrate-handler)
  ↓  ← 並列
React ビルド & S3 デプロイ + CloudFront キャッシュ無効化
```

## GitHub Secrets 設定

| Secret | 説明 |
|---|---|
| `AWS_ACCOUNT_ID` | AWSアカウントID |
| `TF_STATE_BUCKET` | Terraform state用S3バケット名 |
