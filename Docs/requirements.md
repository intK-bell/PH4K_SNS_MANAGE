# SNS自動運用基盤 要件定義書

## 1. 目的

本システムは、X向け投稿案の生成、LINE上での人手選択、選択後の自動投稿、投稿実績および指標の保存、Googleスプレッドシートへの同期を一貫して行うための運用基盤である。

目的は以下の3点とする。

1. SNS運用の手間を下げる
2. 投稿候補の比較・選定を高速化する
3. 投稿結果を蓄積し、勝ちパターンを分析できるようにする

本システムは、`ネタ管理 -> 候補生成 -> 人による選択 -> 自動投稿 -> 指標蓄積 -> スプレッドシート閲覧` を一つの運用ループとして成立させることを目的とする。

## 2. スコープ

### 対象

- AWSベースで構築するSNS自動運用基盤
- 対象SNSはX
- 候補選択UIはLINE
- 管理対象データはDynamoDBで一元管理
- 閲覧・集計はGoogleスプレッドシートで行う
- 投稿候補生成にはOpenAI APIを利用する
- ワークフロー制御にはStep Functionsを利用する

### 非対象

- 複数SNS同時対応
- 独自の分析フロント画面
- 高度な権限管理
- 課金機能
- 外部CRMとの連携
- 学習済み推薦モデルの実装

## 3. 全体方針

### 基本方針

- 正本データはDynamoDB
- 閲覧用はGoogleスプレッドシート
- 人の判断を残しつつ、運用を可能な限り自動化する
- 投稿前に必ずLINEで人が選択する
- 投稿後の実績データは自動取得し、スプレッドシートで確認する
- まずは1人運用を前提としたシンプルな構成で作る

## 4. 投稿運用ルール

### 投稿型の役割

- ①〜⑦: 刺す（営業）
- ⑧: 広げる（拡散）

### 投稿頻度

- ①〜⑦: 2投稿/日
- ⑧: 1投稿/日

### 1日あたりの合計

- 3投稿/日

### 運用方針

- 毎日3投稿を基本とする
- 営業用投稿と拡散用投稿を必ず混在させる
- 投稿候補生成時に、当日の不足枠を見て生成対象の型を制御できるようにするのが望ましい
- MVPでは手動選択でもよいが、将来的には`当日未消化の型`を優先表示できるよう拡張可能な設計にする

## 5. ユースケース

### UC-01 ネタを登録する

運用者は管理画面または管理用入力手段でネタを登録できる。

### UC-02 投稿候補を生成する

運用者は登録済みネタを選択し、投稿型を指定してOpenAI APIで複数の投稿候補を生成できる。

### UC-03 LINEで投稿候補を受け取る

生成された候補のうち選抜された数件をLINEへ送信する。LINE上では候補本文を確認し、`投稿`、`保留`、`破棄`、`再生成` などの操作ができる。

### UC-04 選択した候補をXへ自動投稿する

LINEで`投稿`が選ばれた候補は、自動的にXへ投稿される。

### UC-05 投稿結果を自動取得する

投稿後、一定時間後にX APIから各種指標を取得し、DynamoDBへ保存する。

### UC-06 スプレッドシートで閲覧する

運用者はGoogleスプレッドシート上で投稿一覧、型別傾向、指標推移、横展開候補などを確認できる。

## 6. 機能要件

### 6.1 ネタ管理機能

#### 概要

投稿の元となるネタを管理する。

#### 要件

- ネタを新規登録できる
- ネタ一覧を取得できる
- ネタを編集できる
- ネタをアーカイブできる
- 優先度を設定できる
- タグを付与できる
- 利用回数を保持できる
- ネタごとに関連候補・関連投稿を参照できる

#### 登録項目

- ideaId
- title
- problem
- detail
- priority
- tags
- status
- useCount
- createdAt
- updatedAt

### 6.2 投稿候補生成機能

#### 概要

登録ネタをもとにOpenAI APIで候補文を生成する。

#### 要件

- 1つのネタから複数候補を生成できる
- 投稿型を選択できる
- 型は最低8種類を管理できる
- フックと本文を分けて保持する
- 生成時のプロンプトバージョンを保存する
- 生成結果の一覧取得ができる
- 候補を手動編集できる
- 候補をLINE送信対象に選べる
- 再生成できる

#### 対応する投稿型

1. 気づき喚起型
2. 残業訴求型
3. Before/After系
4. 問いかけ2連発
5. 軽い実績・共感系
6. CTA
7. 制約提示型
8. 拡散特化型

### 6.3 LINE連携機能

#### 概要

人が投稿候補を選ぶためのUIとしてLINEを利用する。

#### 要件

- LINE Messaging APIを使用する
- 候補文をLINEへpush送信できる
- 候補ごとに操作ボタンを表示できる
- 選択アクションをWebhookで受信できる
- Webhook署名を検証する
- 候補に対して以下の操作ができる
- 投稿
- 保留
- 破棄
- 再生成

### 6.4 X自動投稿機能

#### 概要

LINEで選択された候補をXへ投稿する。

#### 要件

- 候補本文をXへ投稿できる
- 投稿成功時に外部投稿IDを保存する
- 投稿URLを保存する
- 投稿日時を保存する
- 投稿失敗時にステータスをエラーとして保存する
- 投稿文字数制約を事前に検証する
- 将来の複数SNS対応を見据え、SNSアダプタ方式にする

### 6.5 投稿結果取得機能

#### 概要

投稿後にX APIから実績指標を取得し保存する。

#### 要件

- 投稿後1時間後に取得
- 投稿後24時間後に取得
- 投稿後72時間後に取得
- 取得した値を履歴として保存する
- 最新値も投稿レコードに反映する
- 取得失敗時は再試行できる
- 取得対象指標はAPI仕様に応じて設定可能とする

#### 想定指標

- impressions
- likes
- replies
- reposts
- bookmarks または保存相当指標
- quoteCount（取得可能なら）

### 6.6 スプレッドシート同期機能

#### 概要

DynamoDB上のデータをGoogleスプレッドシートへ同期し、閲覧・集計を行えるようにする。

#### 要件

- 投稿一覧をスプレッドシートへ反映する
- 指標更新時に対象行を更新する
- ネタ一覧または候補一覧も必要に応じて別シートへ反映できる
- スプレッドシートは閲覧用であり、DynamoDBを正本とする
- 同期失敗時は再実行できる
- 手動同期・定期同期の両方に対応可能な設計とする

#### 想定シート

- 投稿管理
- ネタ帳
- 分析
- KPI

#### 投稿管理シート項目

- ID
- 投稿日
- 型
- ネタ
- フック
- 本文
- ステータス
- インプレッション
- いいね
- 保存
- コメント
- リンククリック
- 横展開
- 投稿URL
- メモ

#### シート運用ルール

- `投稿管理 / 分析 / KPI / ネタ帳` は `syncToSpreadsheet` が DynamoDB を正本として再生成する
- `ネタ帳` シートへ直接 idea を追記しても、現状は生成処理に使われず、次回同期で DynamoDB 側の内容に上書きされる
- idea を追加・編集する場合は `ideas` API または DynamoDB の `ideas` table を正本として更新する
- `投稿管理` の `横展開` は引用数ではなく、同じネタから派生投稿を作るための運用メモ欄として扱う
- `横展開` に数値を入れる場合は、引用された数ではなく「作った派生投稿数」または「横展開したい優先度」のような手動管理値とする
- `投稿管理` の `メモ / 横展開` も現状は同期時に空で再生成されるため、手入力を残す運用にする場合は別途永続化が必要

## 7. 非機能要件

### 可用性

- 単一運用者向けのため高可用性は過剰に追わない
- ただしLambda失敗時の再試行は実装する

### セキュリティ

- SecretsはSecrets Managerで管理する
- LINE Webhook署名を検証する
- IAMは最小権限
- CloudWatch Logsで監査可能とする
- Google Sheets更新はサービスアカウントで行う

### 拡張性

- SNSアダプタを差し替え可能にする
- 投稿型の追加を容易にする
- 将来的に独自ダッシュボードを足せる設計にする

### 保守性

- Lambdaは機能単位で分離する
- Step Functionsで状態遷移を可視化する
- 環境変数は整理する
- TypeScriptで実装する

## 8. AWS構成

### 利用サービス

- API Gateway
- AWS Lambda
- AWS Step Functions
- Amazon DynamoDB
- Amazon EventBridge Scheduler
- AWS Secrets Manager
- Amazon CloudWatch Logs
- Amazon S3
- Google Sheets API
- LINE Messaging API
- OpenAI API
- X API

## 9. ワークフロー設計

### WF-01 候補生成〜LINE送信

1. ネタを選ぶ
2. `generateCandidates` Lambda 実行
3. candidates保存
4. `pushCandidatesToLine` Lambda 実行
5. LINEへ送信

### WF-02 LINE選択〜X投稿

1. LINE Webhook受信
2. `handleLineWebhook` Lambda 実行
3. 候補ステータス更新
4. `publishSelectedPost` Lambda 実行
5. posts保存
6. 指標取得用スケジュール登録
7. スプレッドシート反映

### WF-03 指標取得〜スプシ同期

1. EventBridge Scheduler起動
2. `fetchPostMetrics` Lambda 実行
3. metrics保存
4. post最新値更新
5. `syncToSpreadsheet` Lambda 実行

## 10. DynamoDBデータ設計

### ideas

- ideaId
- title
- problem
- detail
- priority
- tags
- status
- useCount
- createdAt
- updatedAt

### candidates

- candidateId
- ideaId
- type
- hook
- body
- selected
- status
- promptVersion
- lineDeliveryStatus
- createdAt
- updatedAt

### posts

- postId
- candidateId
- ideaId
- snsType
- externalPostId
- postUrl
- postedAt
- status
- latestImpressions
- latestLikes
- latestReplies
- latestReposts
- latestBookmarks
- updatedAt

### metrics

- postId
- fetchedAt
- impressions
- likes
- replies
- reposts
- bookmarks
- quoteCount

## 11. Lambda一覧

- generateCandidates
- pushCandidatesToLine
- handleLineWebhook
- publishSelectedPost
- fetchPostMetrics
- createMetricFetchSchedule
- syncToSpreadsheet
- listIdeas
- createIdea
- updateIdea
- listCandidates
- updateCandidate
- listPosts
- getDailyPostingPlan

## 12. MVP定義

### MVPに含める

- ネタCRUD
- OpenAIによる候補生成
- LINEへの候補送信
- LINEからの選択
- Xへの自動投稿
- 投稿指標の定期取得
- DynamoDB保存
- Googleスプレッドシート同期
- 1日3投稿運用ルールの管理

### MVPに含めない

- 独自分析フロント
- 複数SNS対応
- 高度な分析グラフ
- A/Bテスト自動判定
- 複数ユーザー権限管理

## 13. 実装上の注意

- X APIの仕様変更や利用制限に備え、投稿処理と指標取得処理はインターフェースで分離する
- LINE Webhookは署名検証必須
- Step Functionsはまずシンプルな直列フローから始める
- OpenAIの出力はそのまま使わず、文字数や禁止表現の検証を入れる
- 候補文は手動編集可能にする
- スプレッドシートは正本にしない
- 当日の投稿本数ルールを判定できるように、型別の投稿日集計を取りやすくする
