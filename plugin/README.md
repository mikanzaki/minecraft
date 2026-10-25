# DiscordGate

特定のDiscordサーバーへの参加とDiscord認証を確認してから、Minecraftサーバーへの接続を許可する **Paper 26.2** 向けプラグインです。

## 要件

- **Paper API / Minecraft API 26.2**
- **Java 25以上**（ビルド・実行）
- Discord認証を処理するWebバックエンド

## 設定

`src/main/resources/config.yml` の初期設定はサンプルです。ビルド後にJARを一度起動すると、`plugins/DiscordGate/config.yml` が作成されます。次を設定してサーバーを再起動してください。

```yaml
api-base-url: "https://auth.example.com"
api-key: "WebサービスのPLUGIN_API_KEYと同じ値"
connect-timeout-seconds: 3
request-timeout-seconds: 5
```

- `api-base-url` はWebサービスの公開HTTPS URLで、**末尾のスラッシュなし**にしてください。
- `api-key` はWebサービスの `PLUGIN_API_KEY` と完全に同一の共有鍵です。公開リポジトリやログに載せないでください。
- タイムアウト値は秒で、接続確立とリクエスト全体を別々に制限します。

## ビルド

Java 25以上を利用して、プロジェクト直下で実行します。

```bash
./gradlew clean build
```

生成物は `build/libs/DiscordGate-1.0.5.jar` です。Paper APIだけをcompileOnly依存として使います。`gradlew` はGradle 9.1.0を取得する同梱ブートストラップです。

## 導入

1. 古いDiscordGate JARを `plugins/` から取り除き、`build/libs/DiscordGate-1.0.5.jar` をMinecraftサーバーの `plugins/` に配置します。
2. サーバーを一度起動し、`plugins/DiscordGate/config.yml` を編集します。
3. `api-base-url` と `api-key`（Webサービスの `PLUGIN_API_KEY` と同じ値）を設定します。
4. Paperサーバーを再起動します。

## 認証API契約

プレイヤー接続時、`AsyncPlayerPreLoginEvent` の非同期スレッドから次を送ります。

```http
POST {api-base-url}/api/v1/check
Authorization: Bearer {api-key}
Content-Type: application/json

{"uuid":"Minecraft UUID","username":"player name"}
```

HTTP 200の `status` が `ALLOW` の場合のみ接続を許可します。`LINK_REQUIRED` なら切断画面にドメインと本人用のランダムな4桁数字コードを表示します。プレイヤーは `https://discord.yydassai.f5.si/` をブラウザーで開き、ログイン画面にその数字を入力します。コードは10分で失効し、OAuth開始時に一度だけ使用できます。同一IPからの入力は5分間に最大3回です。長い `login.html?code=...` URLやQRコードは不要です。`GUILD_REQUIRED` なら対象Discordサーバーへの参加後、新しく表示されるコードで再認証するよう案内します。通信・JSON・HTTPエラー、`TEMPORARY_ERROR`、未知のステータスはいずれも安全側に倒して一時的検証失敗として拒否します。
