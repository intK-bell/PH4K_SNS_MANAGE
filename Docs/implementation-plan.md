# SNS自動運用基盤 実装計画

## 1. 実装の前提

- MVPを最短で通す
- 正本はDynamoDB、スプレッドシートはビュー用途に限定する
- 複数SNS対応は将来拡張前提で、MVPはX専用で固定する
- まずは1人運用を前提とし、管理画面なしでもAPIとLINEで回る状態を作る

## 2. 実装フェーズ

### Phase 0: 土台作成

- TypeScriptワークスペース構成を作成
- lint / format / test の基本設定を追加
- 環境変数定義と `.env.example` を追加
- CDKプロジェクトを初期化

### Phase 1: ドメインとデータ基盤

- `Idea`, `Candidate`, `Post`, `MetricSnapshot` の型定義
- 投稿型・ステータス列挙型の定義
- DynamoDB repository 実装
- 一覧・作成・更新の基本ユースケース作成

### Phase 2: ネタ管理API

- `GET /ideas`
- `POST /ideas`
- `GET /ideas/{ideaId}`
- `PUT /ideas/{ideaId}`
- 入出力バリデーション
- エラーレスポンス整備

### Phase 3: 候補生成

- OpenAI adapter 実装
- 投稿型ごとのプロンプトテンプレート定義
- `generateCandidates` 実装
- 候補の保存
- 文字数・禁止表現の検証

### Phase 4: LINE連携

- LINE push送信 adapter 実装
- `pushCandidatesToLine` 実装
- `POST /webhooks/line` 実装
- 署名検証
- `投稿 / 保留 / 破棄 / 再生成` の分岐実装

### Phase 5: X投稿

- X adapter 実装
- `publishSelectedPost` 実装
- 投稿成功時の posts 保存
- 投稿失敗時の status 更新

### Phase 6: 指標取得とスケジューリング

- `createMetricFetchSchedule` 実装
- 1h / 24h / 72h スケジュール登録
- `fetchPostMetrics` 実装
- metrics 履歴保存
- post 最新値更新

### Phase 7: スプレッドシート同期

- Google Sheets adapter 実装
- `syncToSpreadsheet` 実装
- 投稿管理シートの行追加・更新
- 必要ならネタ帳シート反映も追加

### Phase 8: Workflow統合

- Step Functions 定義作成
- 候補生成フロー統合
- 投稿フロー統合
- 指標同期フロー統合

### Phase 9: 運用ルール実装

- `getDailyPostingPlan` 実装
- 当日投稿数の集計
- 営業2件 / 拡散1件の不足枠判定
- 候補生成時の優先型補助ロジック実装

### Phase 10: 仕上げ

- README整備
- ローカル開発手順作成
- デプロイ手順作成
- 運用時の監視項目整理

## 3. 優先度

### 最優先

- Idea CRUD
- Candidate生成
- LINE選択
- X投稿
- Metrics取得
- Spreadsheet同期

### 後回しでよいもの

- 分析シート強化
- 候補優先表示の高度化
- スクリプト類の拡充

## 4. 成果物の順番

1. ワークスペース初期ファイル
2. core domain
3. CDKスタック
4. API Lambda
5. Worker Lambda
6. Step Functions
7. README
8. ローカル開発手順
9. デプロイ手順

## 5. 各フェーズの完了条件

### Phase 0 完了条件

- `npm` または `pnpm` で依存解決できる
- TypeScriptビルドが通る

### Phase 1 完了条件

- DynamoDBに `ideas`, `candidates`, `posts`, `metrics` を保存できる
- 共通型がAPIとWorkerから参照できる

### Phase 2 完了条件

- Idea CRUD API がローカル実行で確認できる

### Phase 3 完了条件

- 1つのネタから複数候補が保存される
- `hook` と `body` が分離されている

### Phase 4 完了条件

- LINEに候補が送られる
- Webhookでアクションを受け取れる

### Phase 5 完了条件

- `投稿` アクションでXに投稿できる
- post URL と externalPostId が保存される

### Phase 6 完了条件

- 1h / 24h / 72h の取得ジョブが作られる
- metrics 履歴と latest 値が更新される

### Phase 7 完了条件

- 投稿管理シートに反映できる
- 更新時に同一投稿行が更新される

### Phase 8 完了条件

- 候補生成から指標取得までフローで追える
- 失敗時の再試行方針が定義される

## 6. リスクと先回り

### X API

- 仕様変更や権限制限があるけん、adapter経由に限定する

### LINE Webhook

- 署名検証が抜けると危険やけん、最初からmiddleware化する

### OpenAI出力

- 文字数超過や禁止表現混入があり得るけん、保存前バリデーションを必須にする

### Spreadsheet同期

- 正本化すると破綻するけん、DynamoDBからの片方向同期に固定する

## 7. 次アクション

次に着手するべき作業は以下。

1. `pnpm install` で依存解決
2. `ideas` API のローカル疎通確認
3. `candidates` API と `posts` API を追加
4. `generateCandidates` から順に Worker 実装

## 8. 現時点からの仕上げ計画

現状は MVP の主要機能が一通りつながっとるけん、ここからは新機能追加よりも「運用できる状態への仕上げ」を優先する。

### Step 1: 運用Runbook整備

- `README` に手動リカバリ手順を追加
- failed jobs の確認方法を整理
- `retry-line` / `retry-sheet` の実行手順を明文化
- CloudWatch Logs Insights の確認フローをまとめる

### Step 2: 外部APIの本番疎通確認

- LINE の push / webhook を dev 環境で実確認
- X の publish / metrics を dev 環境で実確認
- Google Sheets の同期結果を実シートで確認
- `generate -> LINE -> post -> metrics -> sheets` の通し確認を行う

### Step 3: Step Functions / Scheduler 実運用確認

- `candidate-delivery` の入出力を確認
- `post-publish` の入出力を確認
- `metric-sync` の実行パターンを確認
- `1h / 24h / 72h` の Scheduler 実行が想定通りか確認
- 再実行時の挙動を確認

### Step 4: 失敗導線の運用完成

- `GET /jobs/failed` を起点にした運用フローを整理
- LINE push failed の再実行導線を確認
- Sheets sync failed の再実行導線を確認
- 必要に応じて failed jobs 一覧取得を GSI で最適化する

### Step 5: Google Sheets の最終調整

- `投稿管理` シートの列と表示を運用目線で見直す
- `分析` シートの集計項目を見直す
- `ネタ帳` シートの列構成を見直す
- 評価欄、メモ欄、横展開欄の使い方を整理する

### Step 6: CDK / 環境設定の仕上げ

- 環境変数の棚卸し
- IAM 権限の最終確認
- Lambda / State Machine / Scheduler 名称の整理
- dev / prod を分けやすい構成へ寄せる

### Step 7: E2E確認観点の整理

- 毎回確認する運用チェックリストを作る
- 本番前に見るべき確認項目を固定する
- 自動テストが薄い部分を運用チェックで補う

## 9. 推奨の進め順

1. `README` に運用Runbook追加
2. 外部APIの通し疎通確認
3. 失敗導線の運用固め
4. `CDK / env` の整理
