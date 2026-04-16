# Docs

このフォルダは、`SNS自動運用基盤` の設計・実装を進めるためのドキュメント置き場です。

## ドキュメント一覧

1. `requirements.md`
   - 要件定義の整理版
   - スコープ、ユースケース、機能要件、非機能要件、運用ルールを定義
2. `architecture-plan.md`
   - 推奨ディレクトリ構成
   - レイヤ構成
   - AWS/IaC構成案
3. `implementation-plan.md`
   - MVPの実装順序
   - フェーズごとの作業内容
   - 成果物と確認観点
4. `work-log.md`
   - 実作業の記録
   - 追加したファイルと次の着手内容

## 進め方

以下の順番で進めることを前提にしています。

1. `requirements.md` を正本として要件を固定する
2. `architecture-plan.md` でファイル構成とシステム構成を確定する
3. `implementation-plan.md` に沿って土台から実装する
4. `work-log.md` に都度実施内容を追記する

## 次の実装対象

初手は以下です。

1. TypeScript モノレポ構成または単一アプリ構成の決定
2. IaCベースのAWSリソース定義
3. ドメインモデル・DynamoDBテーブル定義
4. Lambda共通基盤の整備
5. API / Workflow / Adapter実装
