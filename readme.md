# 音声作業記録アプリ V1 β版

## 概要

**voice\_work\_memo\_v1** は、音声作業の記録や管理を支援するためのウェブアプリケーションです。ユーザーは、作業の開始・終了時刻、重量、回数、温度などのデータを記録・編集し、API を通じてサーバーとデータを同期できます。

## 特徴

* **インタラクティブなデータ入力**: テーブル形式でのデータ入力・編集が可能で、各セルは `contentEditable` により直接編集できます。
* **開始・終了時刻の自動設定**: 開始時刻を入力すると、自動的に10分後の終了時刻が設定されます。
* **現在時刻の入力**: 「現在時刻」と入力すると、その時点の時刻が自動で入力されます。
* **ダイアログによるデータ取得**: 「開始」ボタンを押下すると、日付とIDを入力するダイアログが表示され、入力内容に基づいてGASのWeb APIからデータを取得します。
* **データの自動保存**: テーブルの内容が変更されると、10秒ごとに自動でサーバーにデータが送信されます。
* **ユーザーインターフェースの強化**: 保存中や保存完了時には、画面右上にステータスメッセージがアニメーション付きで表示されます。
* **データ破棄の確認**: テーブルにデータが存在する場合、ページの更新や戻る操作時に確認ダイアログが表示され、誤操作によるデータの損失を防ぎます。

## 使用方法

1. **リポジトリのクローン**:

   ```bash
   git clone https://github.com/2019Shun/voice_work_memo_v1.git
   ```

2. **ファイルの配置**:
   クローンしたディレクトリ内の `index.html` をブラウザで開きます。`js/script.js` は `index.html` から読み込まれます。

3. **データの入力**:

   * テーブルの各セルをクリックして、必要なデータを入力します。
   * 開始時刻を入力すると、終了時刻が自動的に10分後に設定されます。
   * 「現在時刻」と入力すると、その時点の時刻が自動で入力されます。

4. **データの取得**:

   * 「開始」ボタンを押下すると、日付とIDを入力するダイアログが表示されます。
   * 入力後、「OK」ボタンを押すと、APIからデータが取得され、テーブルに反映されます。

5. **データの保存**:

   * テーブルの内容が変更されると、10秒ごとに自動でサーバーにデータが送信されます。
   * 保存中や保存完了時には、画面右上にステータスメッセージが表示されます。

## 技術的詳細

* **フロントエンド**: HTML, CSS, JavaScript
* **データ通信**: Fetch API を使用して、AWS上のサーバーと通信します。
* **データ形式**: JSON
* **タイムゾーンの考慮**: 日付や時刻の表示・入力時には、ローカルタイムゾーン（例: JST）を考慮しています。

## 注意事項

* ID入力欄には、半角英数字で20文字以内の値を入力してください。条件を満たさない場合、エラーメッセージが表示されます。
* テーブルにデータが存在する状態でページを更新または戻る操作を行うと、確認ダイアログが表示されます。誤ってデータを失わないようご注意ください。

---

## 🆕 変更履歴

| バージョン | リリース日 | 更新内容 |
|------------|-----------|-----------|
| v1.0.0-beta.3 | 2025/07/16 | バックエンドをAWSに移管 |
| v1.0.0-beta.2 | 2025/06/17 | ・IDに数値を入力した際に正しく保存・読み込みできない不具合を修正。<br> ・カラム選択状態になってからのみ、数値を入力できるように修正。また数値入力後、自動的にカラム選択状態をクリアするように変更。<br> ・ID・日付情報を画面に表示するように修正。<br> ・細かいバグ修正。 |
| v1.0.0-beta.1 | 2025/05/27 | 初回リリース |