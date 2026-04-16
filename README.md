# PH4K SNS Manage

X向け投稿案の生成、LINEでの候補選択、Xへの自動投稿、指標取得、Googleスプレッドシート同期までを一貫して扱うSNS自動運用基盤です。

## ドキュメント

- [要件定義](./Docs/requirements.md)
- [アーキテクチャ計画](./Docs/architecture-plan.md)
- [実装計画](./Docs/implementation-plan.md)

## 現在の方針

- AWSベース
- TypeScript実装
- 正本データはDynamoDB
- 閲覧用途はGoogleスプレッドシート
- 候補選択UIはLINE
- ワークフロー制御はStep Functions

## 初期セットアップ予定

1. `pnpm install`
2. ワークスペース配下の `apps`, `packages`, `infra` を作成
3. CDKでAWS基盤を定義
4. API / Worker / Adapter を順に実装

## 外部API疎通確認

非破壊寄りの外部API確認は次で実行できるばい。

```bash
pnpm smoke:external
```

このスクリプトは以下を確認する。

- LINE: bot info 取得と push 送信
- X: `users/me` と recent tweets の read 系確認
- Google Sheets: metadata 取得と `運用確認` シートへの書き込み

注意:

- LINE には `LINE_USER_ID` 向けに疎通確認メッセージを 1 件送る
- Google Sheets には `運用確認` シートを作るか、既存シートの `A1:C4` を更新する
- X への公開投稿はこのスクリプトでは行わない

## CloudWatch Logs Insights クエリ例

`fetchPostMetrics` と `syncToSpreadsheet` は JSON の構造化ログで `correlationId`, `component`, `operation`, `durationMs`, `postId`, `stage`, `attempt` を出すようにしとるけん、CloudWatch Logs Insights ではそのまま集計に使えるばい。

対象ロググループの例:

- `/aws/lambda/ph4k-fetchPostMetrics`
- `/aws/lambda/ph4k-syncToSpreadsheet`

### 直近の失敗一覧

```sql
fields @timestamp, component, operation, postId, errorMessage, spreadsheetSyncAttempts, spreadsheetNextRetryAt
| filter level = "error"
| sort @timestamp desc
| limit 50
```

### 指標取得の処理時間を見る

```sql
fields @timestamp, postId, durationMs
| filter component = "workers.fetchPostMetrics"
| filter message = "metrics fetch completed"
| stats avg(durationMs) as avgDurationMs, max(durationMs) as maxDurationMs, count(*) as executions by bin(1h)
| sort bin(1h) desc
```

### スプレッドシート同期のリトライ状況を見る

```sql
fields @timestamp, postId, stage, attempt, nextDelayMs, errorMessage
| filter component = "workers.syncToSpreadsheet"
| filter message = "spreadsheet sync retry scheduled"
| sort @timestamp desc
| limit 100
```

### postId 単位で metrics と sheets を追跡する

```sql
fields @timestamp, component, message, postId, correlationId, durationMs
| filter postId = "POST_ID"
| sort @timestamp asc
```

### 相関IDで一連の処理を追跡する

```sql
fields @timestamp, component, operation, message, postId, stage, durationMs
| filter correlationId = "CORRELATION_ID"
| sort @timestamp asc
```

### スプレッドシート同期の段階別失敗件数

```sql
fields @timestamp, stage
| filter component = "workers.syncToSpreadsheet"
| filter level = "warn" or level = "error"
| stats count(*) as events by stage, level
| sort events desc
```

## 運用Runbook

### 主要API

- `POST /ideas/{ideaId}/generate`
  候補生成フローを起動する
- `POST /webhooks/line`
  LINE の `投稿 / 保留 / 破棄 / 再生成` を受ける
- `GET /jobs/failed`
  `LINE push failed` と `Sheets sync failed` の一覧を返す
- `POST /candidates/{candidateId}/retry-line`
  失敗した LINE push を再実行する
- `POST /posts/{postId}/retry-sheet`
  失敗した Sheets sync を再実行する

### 日次の確認ポイント

1. `GET /jobs/failed` で失敗ジョブが溜まっていないか確認する
2. `分析 / 投稿管理 / ネタ帳` シートが更新されているか確認する
3. CloudWatch Logs Insights で `error` と `retry` を確認する
4. X 投稿に LP リンク `https://ph4k.aokigk.com/landing` が入っているか確認する

### 手動リカバリ手順

#### 1. LINE push 失敗時

1. `GET /jobs/failed` を実行して `linePushJobs` を確認する
2. 対象 `candidateId` の `lineLastError` と `lineNextRetryAt` を見る
3. LINE のチャネル設定と `LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_ID` を確認する
4. CloudWatch Logs Insights で `workers.pushCandidatesToLine` の失敗ログを確認する
5. 問題が解消したら `POST /candidates/{candidateId}/retry-line` を実行する

#### 2. Sheets sync 失敗時

1. `GET /jobs/failed` を実行して `spreadsheetSyncJobs` を確認する
2. 対象 `postId` の `spreadsheetSyncError` と `spreadsheetNextRetryAt` を見る
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SPREADSHEET_ID` を確認する
4. 対象スプレッドシートでサービスアカウント共有が切れていないか確認する
5. CloudWatch Logs Insights で `workers.syncToSpreadsheet` の `error` と `warn` を確認する
6. 問題が解消したら `POST /posts/{postId}/retry-sheet` を実行する

#### 3. metrics 取得失敗時

1. `workers.fetchPostMetrics` の `error` ログを確認する
2. X API 認証情報と rate limit を確認する
3. Step Functions の `metric-sync` 実行履歴を確認する
4. Scheduler の対象 schedule が存在するか確認する
5. 必要なら該当 `postId` を入力にして worker を手動再実行する

### Step Functions の確認ポイント

- `candidate-delivery`
  候補生成から LINE 送信までの流れを確認する
- `post-publish`
  LINE の `投稿` 選択後に X 投稿と schedule 登録まで流れているか確認する
- `metric-sync`
  metrics 保存から Sheets 同期まで流れているか確認する

失敗時は Execution Input / Output と、対応する Lambda の `correlationId` を突き合わせると追いやすか。

### Step Functions ごとの運用Runbook

#### 1. `candidate-delivery`

目的:

- `ideaId` と投稿型を受けて候補を生成し、LINE へ送る

想定入力:

```json
{
  "ideaId": "IDEA_ID",
  "type": "awareness",
  "count": 3
}
```

主な状態:

1. `GenerateCandidates`
2. `PushCandidatesToLine`

成功時に確認すること:

1. execution output に `generated.items[*].candidateId` が入っとる
2. candidate の `lineDeliveryStatus` が `sent` になっとる
3. LINE に候補メッセージが届いとる

失敗時に見る場所:

1. `GenerateCandidates` 失敗なら `workers.generateCandidates` のログ
2. `PushCandidatesToLine` 失敗なら `workers.pushCandidatesToLine` のログ
3. `GET /jobs/failed` で `linePushJobs` が増えとらんか

よくある確認ポイント:

- `ideaId` が存在するか
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_USER_ID`
- candidate 本文に LP リンクが入っとるか

#### 2. `post-publish`

目的:

- LINE で `投稿` が押された候補を X に投稿し、metrics 取得 schedule を作る

想定入力:

```json
{
  "candidateId": "CANDIDATE_ID"
}
```

主な状態:

1. `PublishSelectedPost`
2. `CreateMetricFetchSchedule`

成功時に確認すること:

1. post が新規作成されとる
2. `externalPostId`, `postUrl`, `postedAt` が入っとる
3. `metric-fetch-{postId}-1h / 24h / 72h` の schedule が作られとる

失敗時に見る場所:

1. `PublishSelectedPost` 失敗なら `workers.publishSelectedPost` のログ
2. `CreateMetricFetchSchedule` 失敗なら `workers.createMetricFetchSchedule` のログ
3. X API 認証情報と Scheduler 権限

よくある確認ポイント:

- `candidateId` が存在するか
- candidate の `hook + body` に LP リンクが残っとるか
- `X_API_KEY / X_API_KEY_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET`
- `SCHEDULER_EXECUTION_ROLE_ARN`

#### 3. `metric-sync`

目的:

- X から metrics を取得し、DynamoDB と Google Sheets を更新する

想定入力:

```json
{
  "postId": "POST_ID"
}
```

主な状態:

1. `FetchPostMetrics`
2. `SyncToSpreadsheet`

成功時に確認すること:

1. `metrics` テーブルに履歴が追加されとる
2. `posts.latest*` が更新されとる
3. `投稿管理 / 分析 / ネタ帳` シートに変更が反映されとる

失敗時に見る場所:

1. `FetchPostMetrics` 失敗なら `workers.fetchPostMetrics` のログ
2. `SyncToSpreadsheet` 失敗なら `workers.syncToSpreadsheet` のログ
3. `GET /jobs/failed` で `spreadsheetSyncJobs` が増えとらんか

よくある確認ポイント:

- `externalPostId` が保存されとるか
- X metrics API の権限と rate limit
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`

### Scheduler の確認ポイント

- schedule group は `metric-fetch` を使う
- schedule 名は `metric-fetch-{postId}-{offset}h`
- 期待する offset は `1h / 24h / 72h`
- 同名 schedule がすでにある場合は `skipped` か `replaced` になる

### 運用時に確認する主な環境変数

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LINE_USER_ID`
- `X_API_KEY`
- `X_API_KEY_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BEARER_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`
- `CANDIDATE_DELIVERY_STATE_MACHINE_ARN`
- `POST_PUBLISH_STATE_MACHINE_ARN`
- `PUSH_CANDIDATES_TO_LINE_LAMBDA_ARN`
- `SYNC_TO_SPREADSHEET_LAMBDA_ARN`
- `LP_LANDING_URL`
