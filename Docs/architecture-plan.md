# SNS自動運用基盤 ファイル構成案 / アーキテクチャ計画

## 1. 推奨ディレクトリ構成

```text
PH4K_SNS_manage/
├── Docs/
│   ├── README.md
│   ├── requirements.md
│   ├── architecture-plan.md
│   └── implementation-plan.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   ├── ideas/
│   │   │   │   ├── candidates/
│   │   │   │   ├── posts/
│   │   │   │   └── webhooks/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── usecases/
│   │   │   ├── adapters/
│   │   │   ├── domain/
│   │   │   ├── lib/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   └── workers/
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── generateCandidates.ts
│       │   │   ├── pushCandidatesToLine.ts
│       │   │   ├── publishSelectedPost.ts
│       │   │   ├── fetchPostMetrics.ts
│       │   │   ├── createMetricFetchSchedule.ts
│       │   │   └── syncToSpreadsheet.ts
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── usecases/
│       │   ├── adapters/
│       │   ├── domain/
│       │   └── lib/
│       ├── tests/
│       └── package.json
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   ├── schemas/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   ├── infra/
│   │   ├── src/
│   │   │   ├── dynamodb/
│   │   │   ├── secrets/
│   │   │   ├── scheduler/
│   │   │   └── logger/
│   │   └── package.json
│   ├── adapters/
│   │   ├── src/
│   │   │   ├── openai/
│   │   │   ├── line/
│   │   │   ├── x/
│   │   │   └── sheets/
│   │   └── package.json
│   └── config/
│       ├── src/
│       │   ├── env.ts
│       │   └── featureFlags.ts
│       └── package.json
├── infra/
│   ├── cdk/
│   │   ├── bin/
│   │   ├── lib/
│   │   │   ├── stacks/
│   │   │   ├── constructs/
│   │   │   └── state-machines/
│   │   ├── cdk.json
│   │   └── package.json
│   └── stepfunctions/
│       ├── candidate-delivery.asl.json
│       ├── post-publish.asl.json
│       └── metric-sync.asl.json
├── scripts/
│   ├── seed-ideas.ts
│   ├── sync-sheet-manual.ts
│   └── local-test-webhook.ts
└── README.md
```

## 2. 構成方針

### 方針

- API系Lambdaと非同期Worker系Lambdaを分ける
- ドメインと外部API依存を分離する
- OpenAI / LINE / X / Google Sheets は adapter 層に閉じ込める
- DynamoDBアクセスは repository 層で統一する
- 共通型・定数・バリデーションは `packages/core` に寄せる

### これにする理由

- Lambdaごとの責務が見えやすい
- 将来の複数SNS対応で adapter 差し替えがしやすい
- APIとバッチの実装重複を減らせる
- Step Functions と Lambda の責務境界を明確にできる

## 3. ドメイン設計方針

### 主なエンティティ

- Idea
- Candidate
- Post
- MetricSnapshot
- DailyPostingPlan

### 補助的な値オブジェクト

- PostType
- CandidateStatus
- PostStatus
- SnsType
- PromptVersion

### 先に固定すべきルール

- 投稿型 1〜7 を営業用、8 を拡散用として扱う
- 1日3投稿の内訳は営業2件、拡散1件
- 候補は `hook` と `body` を分離して保存する
- `posts` は最新指標を持ち、`metrics` は履歴を持つ

## 4. DynamoDB設計方針

MVPではテーブル分離を優先し、実装のわかりやすさを取る。

### テーブル

- `ideas`
- `candidates`
- `posts`
- `metrics`

### 追加想定GSI

- `ideas`: `status-updatedAt-index`
- `candidates`: `ideaId-createdAt-index`, `status-createdAt-index`
- `posts`: `postedAt-index`, `candidateId-index`
- `metrics`: `postId-fetchedAt-index`

### 理由

- MVP段階では単一テーブル設計より保守しやすい
- 運用ルール判定で日付ベースの取得が多い
- idea起点、candidate起点、post起点の参照が分かりやすい

## 5. API構成案

### Ideas

- `GET /ideas`
- `POST /ideas`
- `GET /ideas/{ideaId}`
- `PUT /ideas/{ideaId}`

### Candidates

- `GET /candidates`
- `PUT /candidates/{candidateId}`
- `POST /ideas/{ideaId}/generate`
- `POST /candidates/{candidateId}/send-line`

### Posts

- `GET /posts`

### Webhooks

- `POST /webhooks/line`

## 6. Lambda責務整理

### APIハンドラ

- `listIdeas`
- `createIdea`
- `getIdea`
- `updateIdea`
- `listCandidates`
- `updateCandidate`
- `listPosts`
- `handleLineWebhook`

### Worker

- `generateCandidates`
- `pushCandidatesToLine`
- `publishSelectedPost`
- `createMetricFetchSchedule`
- `fetchPostMetrics`
- `syncToSpreadsheet`
- `getDailyPostingPlan`

## 7. Step Functions構成案

### 候補生成フロー

1. 入力検証
2. `generateCandidates`
3. `pushCandidatesToLine`
4. 完了記録

### 投稿フロー

1. LINEアクション解釈
2. candidate更新
3. `publishSelectedPost`
4. `createMetricFetchSchedule`
5. `syncToSpreadsheet`

### 指標同期フロー

1. `fetchPostMetrics`
2. latest値更新
3. `syncToSpreadsheet`

## 8. IaC構成案

### 推奨

- AWS CDK(TypeScript)

### スタック分割

- `NetworkStack`
- `DataStack`
- `ApplicationStack`
- `ObservabilityStack`

### ApplicationStack に含めるもの

- API Gateway
- Lambda群
- Step Functions
- EventBridge Scheduler 実行権限
- Secrets Manager 参照権限

### DataStack に含めるもの

- DynamoDBテーブル
- S3バケット

## 9. 外部連携の抽象化

### OpenAI Adapter

- 候補生成
- プロンプトバージョン管理
- レスポンス整形

### LINE Adapter

- push送信
- action payload生成
- webhook署名検証

### X Adapter

- 投稿
- 指標取得
- レート制限考慮

### Google Sheets Adapter

- 行追加
- 行更新
- シート初期化

## 10. 先に作るべき主要ファイル

1. ルート `package.json`
2. `infra/cdk/lib/stacks/application-stack.ts`
3. `packages/core/src/domain/*`
4. `packages/adapters/src/*`
5. `apps/api/src/handlers/*`
6. `apps/workers/src/handlers/*`
7. `infra/stepfunctions/*.asl.json`
8. ルート `README.md`
