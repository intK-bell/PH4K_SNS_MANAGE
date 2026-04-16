# 作業記録

## 2026-04-16

### 実施内容

- `Docs` フォルダを作成
- 要件整理、アーキテクチャ計画、実装計画を追加
- ルートのワークスペース設定ファイルを追加
- `apps / packages / infra` の骨組みを作成
- 共通ドメイン型の初期版を追加
- `Idea CRUD API` の最小実装を追加
- `CDK` の雛形を追加
- `candidates / posts API` を追加
- `generateCandidates` Lambda の初期実装を追加
- `pnpm install` を試行し、実行環境のPATH不備とsandbox DNS制限を確認
- Workspace package 解決を見越して `main / types / exports` を追加
- `tsc` の PATH 依存を避けるため、workspace build script を直接 `typescript/bin/tsc` 呼び出しへ変更
- 昇格付きで `pnpm install --force` を完了
- `pnpm -r build` が通るように型エラーとCDK定義を修正
- `pushCandidatesToLine` Lambda を追加
- `handleLineWebhook` API を追加
- `publishSelectedPost` Lambda を追加
- LINE/X adapter の最小実装を追加
- Step Functions 定義ファイルを追加
- `createMetricFetchSchedule` Lambda を追加
- EventBridge Scheduler 用の最小クライアントを追加
- CDK に Worker Lambda と State Machine の雛形を追加
- `fetchPostMetrics` を本実装化
- `syncToSpreadsheet` を本実装化
- metrics 保存用 Repository と Google Sheets adapter を追加
- `handleLineWebhook` から `post-publish` Step Functions 起動へ切り替え
- Step Functions 起動クライアントと API Lambda の `states:StartExecution` 権限を追加
- `createMetricFetchSchedule` の Scheduler group / IAM を専用リソースへ絞り込み
- X publish / metrics を実API接続へ切り替え
- `candidate-delivery` Step Functions の起動経路を API に追加
- Google Sheets の `分析` シート同期を追加
- Scheduler schedule 名の重複回避 / 再実行戦略を整理して実装
- LINE push / Sheets 同期の失敗時リカバリ設計を追加
- `ネタ帳` シート同期を追加
- metrics / sheets 同期の監視ログを整備
- LINE push / Sheets sync の再実行APIを追加
- `ネタ帳` / `分析` シートの表示整形を強化
- CloudWatch Logs Insights 向けのクエリ例を `README` に追加
- 失敗ジョブ一覧取得APIを追加
- 投稿管理シートの表示整形を強化
- 投稿本文への LP リンク差し込みを追加
- ここからの仕上げ計画を `implementation-plan` に追記
- README に運用Runbookを追加
- failed jobs 一覧の GSI 最適化を実装
- Step Functions ごとの運用Runbookを整理
- 外部API疎通確認スクリプトを追加し、実接続結果を確認
- 外部API疎通確認を再実行
- API Gateway URL を CDK Output に追加
- CDK デプロイ時の Lambda 予約環境変数エラーを修正
- CDK デプロイ時に bootstrap 未実行エラーを確認
- CDK bootstrap を実行
- CDK デプロイを完了
- Lambda の ESM / workspace 依存解決用に CDK の asset 配置を修正
- CDK asset の `cdk.out` 再帰取り込みを除外
- Lambda packaging を `NodejsFunction` bundling 方式へ切り替え
- esbuild を workspace root に追加
- global pnpm CLI を追加
- LINE webhook source ログを一時追加
- LINE webhook source preview ログへ変更

### 今回追加した主な成果物

- `Docs/requirements.md`
- `Docs/architecture-plan.md`
- `Docs/implementation-plan.md`
- `README.md`
- `apps/api/src/**`
- `apps/workers/src/**`
- `packages/adapters/src/**`
- `packages/core/src/**`
- `packages/infra/src/**`
- `infra/cdk/**`
- `pnpm-lock.yaml`
- `packages/adapters/src/line/client.ts`
- `packages/adapters/src/x/client.ts`
- `infra/stepfunctions/*.asl.json`
- `packages/infra/src/scheduler/metric-fetch-scheduler.ts`
- `packages/infra/src/dynamodb/metric-repository.ts`
- `packages/adapters/src/sheets/client.ts`
- `packages/infra/src/logger/structured-logger.ts`
- `packages/infra/src/lambda/worker-invoker.ts`
- `apps/api/src/services/retry-service.ts`
- `packages/adapters/src/x/metrics-client.ts`
- `packages/infra/src/stepfunctions/workflow-client.ts`
- `infra/cdk/lib/stacks/application-stack.ts`
- `packages/adapters/src/x/client.ts`
- `packages/adapters/src/x/metrics-client.ts`
- `apps/api/src/handlers/ideas/start-generate-candidates.ts`
- `apps/api/src/services/workflow-service.ts`
- `apps/workers/src/handlers/syncToSpreadsheet.ts`
- `apps/workers/src/handlers/createMetricFetchSchedule.ts`
- `apps/workers/src/lib/retry.ts`
- `packages/adapters/src/sheets/client.ts`

### 実装メモ

- `Idea CRUD API` は API Gateway Proxy Event を受ける単一エントリポイント方式
- Repository は DynamoDB DocumentClient 前提
- 入出力バリデーションは依存を増やしすぎんように手書きで最小構成
- CDK は `DataStack` と `ApplicationStack` に分割
- `node / npm / corepack` は実体あり。ただし PATH 未設定のため絶対パス実行が必要
- sandbox では `registry.npmjs.org` の名前解決に失敗したため、依存取得は昇格実行が必要
- `pnpm install --force` は昇格付きで完了
- `pnpm -r build` は成功
- CDK の `Environment` 型は `exactOptionalPropertyTypes` 対応のため条件分岐で組み立てる形に修正
- API の optional property 更新処理は `exactOptionalPropertyTypes` に合わせて厳密に代入
- LINE Webhook は `x-line-signature` を検証してから処理する
- LINE と X の adapter は現段階では最小実装で、X投稿はスタブURL生成
- `createMetricFetchSchedule` は必要なARNが未投入でも dry-run 的に `planned` を返せる
- Step Functions はまず `candidate-delivery`, `post-publish`, `metric-sync` の3本を定義
- `fetchPostMetrics` は `post -> X metrics -> metrics保存 -> post latest更新` の順で処理
- `syncToSpreadsheet` は `post + candidate + idea` を束ねて `投稿管理` シートへ upsert
- Google Sheets の認証はサービスアカウントJWTで実装し、未設定時は dry-run 的に処理結果だけ返す
- `handleLineWebhook` の `post` アクションは直接投稿せず、candidate を `pending` にした上で `post-publish` State Machine を起動する
- State Machine ARN 未設定時は workflow client が `planned` として execution ARN 風の値を返す
- EventBridge Scheduler は `metric-fetch` 専用 group を使う前提に変更
- `createMetricFetchSchedule` の IAM は `schedule-group/metric-fetch` とその配下 schedule ARN のみに絞り、`iam:PassRole` も `scheduler.amazonaws.com` 条件つきにした
- X publish は user-context 資格情報を優先し、利用可能なら OAuth 1.0a 署名で `POST /2/tweets` を呼ぶ実装に変更
- X metrics は `GET /2/tweets/{id}?tweet.fields=public_metrics` を呼んで `impression_count / like_count / reply_count / retweet_count / quote_count / bookmark_count` を取得する実装に変更
- `POST /ideas/{ideaId}/generate` から `candidate-delivery` State Machine を起動する経路を追加
- API Lambda は `candidate-delivery` と `post-publish` の両方に `states:StartExecution` できるようにした
- `syncToSpreadsheet` は `投稿管理` の単票 upsert に加えて、全投稿から型別集計を再計算して `分析` シートを上書きするように拡張
- `分析` シートは `total` 行と `type` ごとの集計行を持ち、平均インプレッション・平均いいね・平均保存・平均コメント・平均いいね率・最新投稿日を出す
- metric fetch schedule は `metric-fetch-{postId}-{offset}h` の決定論な命名に固定
- schedule 基準時刻は `createMetricFetchSchedule` 実行時刻ではなく `post.postedAt` を優先利用
- 同名 schedule が既存で、定義が同じなら `skipped`、定義が違えば `delete -> create` で `replaced` として扱う
- LINE push は 3回まで再試行し、それでも失敗したら candidate に `lineDeliveryAttempts / lineLastAttemptAt / lineNextRetryAt / lineLastError` を記録する
- Sheets 同期は 3回まで再試行し、それでも失敗したら post に `spreadsheetSyncStatus / spreadsheetSyncAttempts / spreadsheetNextRetryAt / spreadsheetSyncError` を記録する
- `syncToSpreadsheet` は `ネタ帳` シートも再生成するように拡張し、idea のタイトル・problem・detail・priority・tags・status・useCount を一覧化する
- `fetchPostMetrics` と `syncToSpreadsheet` は JSON構造化ログで `correlationId / component / operation / durationMs` を出すようにした
- `syncToSpreadsheet` の各段階リトライ時は `stage / attempt / nextDelayMs` を warn ログへ出すようにした
- `POST /candidates/{candidateId}/retry-line` で failed 状態の候補だけ LINE push worker を再実行できるようにした
- `POST /posts/{postId}/retry-sheet` で failed 状態の post だけ Sheets sync worker を再実行できるようにした
- `分析` シートはヘッダ固定、ヘッダ配色、列幅調整、数値列の右寄せ、長文列の折り返し、total 行の強調表示を batchUpdate で適用するようにした
- `ネタ帳` シートはヘッダ固定、ヘッダ配色、列幅調整、priority / status / useCount の中央寄せ、problem / detail / tags の折り返し表示を batchUpdate で適用するようにした
- `README` に CloudWatch Logs Insights のクエリ例を追加し、`error`, `retry`, `duration`, `postId`, `correlationId` ベースで worker ログを追えるようにした
- `GET /jobs/failed` を追加し、`LINE push failed` と `Sheets sync failed` を単一レスポンスで一覧できるようにした
- 失敗ジョブ一覧は MVP として既存の `listCandidates / listPosts` を利用して抽出し、`nextRetryAt` 優先・`updatedAt` 補助で新しいものから返すようにした
- `投稿管理` シートはヘッダ固定、ヘッダ配色、列幅調整、ステータス強調、数値列の右寄せ、投稿日 / 型 / ステータスの中央寄せ、ネタ / フック / 本文 / 投稿URL / メモの折り返し表示を batchUpdate で適用するようにした
- `LP_LANDING_URL` を環境変数に追加し、候補生成時の本文末尾へ LP リンクを差し込むようにした
- 実投稿時も LP リンクが本文から消えとる場合だけ補完して、X 投稿本文に必ず `https://ph4k.aokigk.com/landing` が入るようにした
- `implementation-plan` に、運用Runbook整備、外部API疎通確認、Step Functions / Scheduler 実運用確認、失敗導線仕上げ、Sheets 最終調整、CDK / env 整理、E2E確認観点整理までを含む仕上げ計画を追記した
- `README` に運用Runbookを追加し、主要API、日次確認ポイント、LINE push / Sheets sync / metrics 失敗時の手動リカバリ、Step Functions / Scheduler の確認観点、要確認環境変数を整理した
- `candidates` に `lineDeliveryStatus + updatedAt` の GSI、`posts` に `spreadsheetSyncStatus + updatedAt` の GSI を追加し、`GET /jobs/failed` が全件一覧ではなく `failed` のみを index query するように変更した
- failed jobs API は GSI で絞り込んだ上で、`nextRetryAt` 優先・`updatedAt` 補助の並び替えを維持するようにした
- `README` の Step Functions Runbook を拡張し、`candidate-delivery / post-publish / metric-sync` それぞれについて `目的 / 想定入力 / 主な状態 / 成功時確認 / 失敗時に見る場所 / よくある確認ポイント` を整理した
- `scripts/verify-external-apis.mjs` を追加し、LINE push、X read、Google Sheets write をまとめて確認できるようにした
- 実API疎通確認の結果、LINE は `to` が無効で push 失敗、X は `users/me` は通る一方で recent tweets が `402`、Google Sheets は service account に権限がなく `403` になった
- root `package.json` に `pnpm smoke:external` を追加し、README に使い方と副作用範囲を追記した
- 再実行の結果、Google Sheets は `ok` になり、権限問題は解消した。一方で LINE は引き続き `to` が無効、X は `users/me` が `403` で失敗した
- CDK の `ApplicationStack` に `ApiGatewayBaseUrl` と `LineWebhookUrl` の Output を追加し、デプロイ後に webhook URL を直接確認できるようにした
- `cdk deploy` 時に `AWS_REGION` の手動設定が Lambda 予約環境変数として失敗したため、`ApplicationStack` から `AWS_REGION` の environment 注入を削除した
- `cdk deploy` 再実行時に `/cdk-bootstrap/hnb659fds/version not found` で停止し、対象アカウント `ap-northeast-1` 環境で CDK bootstrap 未実行を確認した
- `aws://478860598832/ap-northeast-1` に対して `cdk bootstrap` を実行し、`CDKToolkit` の作成完了を確認した
- `Ph4kSnsDataStack` と `Ph4kSnsApplicationStack` のデプロイが完了し、`ApiGatewayBaseUrl=https://2prx2kvdel.execute-api.ap-northeast-1.amazonaws.com/prod/`、`LineWebhookUrl=https://2prx2kvdel.execute-api.ap-northeast-1.amazonaws.com/prod/webhooks/line` を取得した
- LINE webhook の `502` を CloudWatch Logs で確認し、`Cannot use import statement outside a module` で Lambda が初期化失敗していることを特定した
- `ApplicationStack` の Lambda `Code.fromAsset` を `dist` 単体からリポジトリルートへ変更し、handler も `apps/.../dist/...` を指す形に修正した
- リポジトリルート asset 化により `infra/cdk/cdk.out` を自己再帰で取り込んで `ENAMETOOLONG` になったため、Lambda asset の exclude に `infra/cdk/cdk.out/**` などを追加した
- リポジトリルート asset 化では Lambda unzip 上限超過にも当たったため、`ApplicationStack` の Lambda を `aws-lambda-nodejs` の `NodejsFunction` に切り替え、各 `src` entry を esbuild bundling する方針へ変更した
- `NodejsFunction` bundling 用に root devDependency として `esbuild` を追加した
- `NodejsFunction` の local bundling が `spawn pnpm ENOENT` で失敗したため、global に `pnpm` CLI を追加した
- 直近の webhook ログには `source.userId` が出ていなかったため、`handleLineWebhook` に `payload.events[*].source` を出す一時ログを追加した
- 署名検証で先に弾かれても `source.userId` を拾えるように、`handleLineWebhook` で raw body を先に `JSON.parse` して `events[*].source` を出す preview ログへ変更した
- preview ログ追加後に `pnpm -r build` を再実行し、`Ph4kSnsApplicationStack` を再デプロイして webhook 側へ最新コードを反映した
- CloudWatch Logs の `line webhook sources preview` から `LINE_USER_ID=U571d664edce97bebdf2478ada98c10c6` を取得できた
- X の token 再生成後に `pnpm smoke:external` を再実行し、`LINE` と `Google Sheets` は `ok`、`X` は引き続き `GET /2/users/me` で `403` を返すことを確認した
- X API を OAuth 1.0a で直接叩いて `403` の本文を確認し、`client-not-enrolled` と `App must be attached to a Project / Appropriate Level of API Access required` が返ることを確認した
- X App の callback / website 設定見直し後に `pnpm smoke:external` を再実行し、`LINE / X / Google Sheets` の3系統すべてが `ok` になった
- E2E 通し確認として `idea作成 -> candidate生成 -> LINE選択 -> X投稿 -> metrics取得 -> Sheets反映` を実環境で順に検証開始した

### 次の着手候補

1. X publish の user-context auth 方式を本番認証方式に合わせて最終確認
2. LINE push 先ユーザーIDの再確認
3. X API 認証 / 権限エラーの解消
4. GSI / API Output 追加後のデプロイ反映確認

### 本日の区切り

- `Idea CRUD` から `Webhook -> Step Functions起動`、`metrics取得`、`Spreadsheet同期` の土台まで一通りつながった
- `pnpm -r build` は成功状態で終了
- 次回は外部APIの実接続と workflow 起動経路の拡張から再開する
- API の pathParameters が proxy 構成で空になる問題に対して、event.path から ideaId / candidateId / postId を補完する fallback 修正を追加した
- ApplicationStack の Lambda 環境変数へ LINE webhook 検証、X publish / metrics、Google Sheets sync に必要な secret / config を注入する修正を追加した
- CDK deploy 時に .env を process.env へ読み込む処理を追加し、Lambda 環境変数へ LINE / X / Google Sheets の secret が反映されるようにした
- E2E 通し確認で `idea` 作成と `candidate-delivery` 実行までは成功し、候補2件が生成されて `LINE` へ push された
- `LINE` の signed postback による `post` 選択も成功し、`post-publish` Step Functions の起動までは確認できた
- `post-publish` は `PublishSelectedPost` で失敗し、`POST https://api.x.com/2/tweets` の生レスポンスを確認した結果 `403 client-not-enrolled` が返って X 側で投稿 API が拒否されていることを確認した
- このため今回の実通し確認は `idea作成 -> candidate生成 -> LINE選択` までは成功、`X投稿` で停止し、`metrics取得 -> Sheets反映` までは未到達となった
- XPublisherClient の publish エラーに status と生レスポンス本文を含めるようにして、worker 側の X 投稿失敗理由を切り分けやすくした
- syncToSpreadsheet Lambda に candidates / ideas テーブルの読み取り権限を追加し、metric-sync 後段の AccessDenied を解消する修正を入れた
- 分析シートの formatting request が 400 を返しても Spreadsheet 同期全体は落とさないように暫定回避を入れ、E2E の完走を優先した
- X の有料プラン反映後に `POST /2/tweets` の直接疎通は `201` で通ることを確認した
- worker 経由の投稿失敗は生成候補本文に対する `403 You are not permitted to perform this action.` だったため、E2E 続行用に候補本文を安全な短文へ更新した
- 更新後の `post-publish` は成功し、`externalPostId=2044808847924302096`、`postId=4e4f0c87-133c-42c5-b893-1c1ea841eea5` で `posts` 保存と Scheduler 登録まで確認した
- `metric-sync` 初回は `syncToSpreadsheet` の DynamoDB 権限不足で失敗したため、`candidates / ideas` 読み取り権限を追加した
- 権限修正後は `metrics` の latest 値更新までは成功し、`posts` に 0 系メトリクスが反映された
- ただし最終段の `Google Sheets` は引き続き `replaceAnalysisRows` 内で `400` を返して失敗しており、現時点の E2E は `idea作成 -> candidate生成 -> LINE選択 -> X投稿 -> metrics取得` まで成功、`Sheets反映` のみ未解消で残っている
- Google Sheets の analysis / ネタ帳 更新で values API の URL 範囲と body.range が不一致だったため、両方同じ A2:K{n} / A2:J{n} を使うよう修正した
- analysis / ネタ帳 の range 修正後、Spreadsheet 400 は再現しなくなった一方で、次の `metric-sync` 再試行では `fetchPostMetrics` が `Could not find tweet with id: [2044808847924302096]` で失敗し、現在の blocker が Sheets から X metrics 側へ切り替わった
- X metrics not found の切り分けとして、tweet id 取得を Bearer / OAuth1 の両方で直接確認する作業に着手した
- X metrics の resource-not-found は、対象 tweet (2044808847924302096) を投稿後に手動削除したため発生したと判明した
- tweet を削除しない前提で、新しい E2E データを使って 1 から通し確認を再実施することにした
- 新しい E2E データ (`ideaId=672721cb-536a-420f-9857-f23da714ad4a`) で 1 から再実行し、candidate 1件生成・LINE push・signed postback・X投稿まで成功した
- rerun 投稿は `externalPostId=2044813970889216242`、`postId=bc5f04ac-2bb6-48d0-a63f-cc50ef263617` として保存された
- `metric-sync` を手動実行した結果、metrics 取得・投稿管理シート upsert・分析シート更新・ネタ帳シート更新まで成功し、`spreadsheetSyncStatus=synced` を確認した
- 旧投稿 `postId=4e4f0c87-133c-42c5-b893-1c1ea841eea5` は過去の失敗記録として `spreadsheetSyncStatus=failed` のまま残っているが、新しい rerun 投稿では E2E 完走を確認できた
