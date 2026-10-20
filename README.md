# minecraft

マインクラフトサーバーDiscord認証スクリプトです。PaperプラグインとDiscord OAuth2認証Webサービスにより、指定Discordサーバーの参加者だけMinecraftへの接続を許可します。

## 公開URLと役割

ログイン画面は公開GitHubリポジトリ[ mikanzaki/minecraft ](https://github.com/mikanzaki/minecraft)のGitHub Pagesで公開し、独自ドメインは[https://discord.yydassai.f5.si](https://discord.yydassai.f5.si)です。認証APIのoriginは`https://guildgate-8kl528pa.manus.space`です。GitHub PagesはHTML/CSS/JavaScriptを配信する静的ホスティングなので、OAuthのClient Secret、Bot Token、データベース、Minecraft接続APIは別のサーバーで実行します。[GitHub Pages公式説明](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) [公開ワークフローの設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

`public/config.js`の`apiBaseUrl`とPaperの`api-base-url`は上記認証API URLに設定します。これは公開originで秘密ではありません。Discord Client Secret、Bot Token、`PLUGIN_API_KEY`はGitHubへコミットしないでください。GitHub PagesからはHTMLフォームで認証開始を要求します。

## 現行Paper版

2026年10月20日時点で、Paper公式ダウンロードページと開発ガイドはPaper/Minecraft API **26.2**を案内し、Java **25以上**のツールチェーンを示しています。この実装はPaper API 26.2、`plugin.yml`の`api-version: '26.2'`、Java 25向けです。[Paperダウンロード](https://papermc.io/downloads/paper) [Paperプロジェクト設定](https://docs.papermc.io/paper/dev/project-setup/) [plugin.yml仕様](https://docs.papermc.io/paper/dev/plugin-yml/)

## 動作の流れ

1. Paperプラグインがログイン前に認証APIへMinecraft UUIDを問い合わせます。
2. Discordアカウントが未連携なら、バックエンドが15分で失効する一回限りのランダムな数字6桁コードを作成します。Minecraft画面には`https://discord.yydassai.f5.si/`とコードを表示します。プレイヤーはそのドメインをブラウザーで開き、ページに6桁コードを入力します。長い`login.html?code=...`を打つ必要はなく、QRコードも表示しません。
3. プレイヤーは`login.html`からDiscord公式OAuth2画面へ進みます。OAuthでDiscord IDを確認し、対象Guildへの在籍をBot APIで調べます。
4. 対象Guildに参加済みなら、Minecraft UUIDとDiscord IDをデータベースに保存します。参加していない場合は接続を許可せず、参加後にMinecraftへ再接続するよう案内します。
5. 連携後も、Minecraftへ接続するたびにDiscord Guildの在籍を確認します。Discord照合APIやネットワークの障害時も許可しません。

DiscordのOAuthアクセストークンは保存しません。リンクコードとOAuth `state`はDBへハッシュで保存し、OAuth `state`は短期のHttpOnly/SameSite Cookieにも結び付けます。同じDiscordアカウントを複数のMinecraft UUIDへ連携させません。

## Discord側の準備

Discord Developer PortalでApplicationを作成し、OAuth2 Client IDとClient Secret、Bot Tokenを取得します。OAuth2 Redirect URIには`https://guildgate-8kl528pa.manus.space/oauth/callback`を登録してください。URLはバックエンドの`APP_BASE_URL`と完全一致させます。

Botを確認対象のDiscordサーバーへ参加させます。今回の対象Guild IDは`1550163473982300392`です。OAuthでは`identify` scopeを使い、在籍確認はBot認証によるDiscord API `GET /guilds/{guild.id}/members/{user.id}`で行います。[Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) [ユーザーAPI](https://docs.discord.com/developers/resources/user) [Guild API](https://docs.discord.com/developers/resources/guild)

## 認証バックエンドの設定

Node.js 22以上とMySQL互換データベースを使います。Manus WebDev Managed Databaseを有効にすると、実行環境に`DATABASE_URL`が提供されます。初回起動時にコード・アカウント紐付け・OAuth stateのテーブルを`CREATE TABLE IF NOT EXISTS`で作成します。

公開バックエンドの環境変数は`.env.example`を参考にします。`APP_BASE_URL`は`https://guildgate-8kl528pa.manus.space`、`PUBLIC_SITE_URL`は`https://discord.yydassai.f5.si`です。Discord用には`DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_BOT_TOKEN`が必要です。対象Guild IDは`1550163473982300392`です。`PLUGIN_API_KEY`は32文字以上のランダムな秘密鍵とし、同じ値をMinecraftの`plugins/DiscordGate/config.yml`にも登録します。例としてローカルで`openssl rand -hex 32`を使って生成できますが、その値を公開ソースへ書かないでください。

プロジェクトのWebDevコンテナ用`Dockerfile`は`PORT`（未指定時3000）でAPIを起動します。`GET /healthz`はDB接続を確認するヘルスチェックです。OAuthを有効にするには、Discordの認証情報とGuild IDを登録し、Redirect URIを`APP_BASE_URL`に合わせます。

## GitHub Pagesの公開

`.github/workflows/deploy-pages.yml`はリポジトリの`main`へのpush時に`public/`だけをGitHub Pagesへ公開します。リポジトリのGitHub **Settings → Pages → Build and deployment → Source**で**GitHub Actions**を選択してください。`public/config.js`の`apiBaseUrl`には`https://guildgate-8kl528pa.manus.space`を設定します。GitHub Pagesは公開インターネット上に表示されます。秘密情報は`public/`にも、GitHubのcommitにも含めないでください。

## Paperプラグインのビルドと導入

Java 25以上を用意し、`plugin/`でGradle Wrapperを実行します。

```bash
cd plugin
./gradlew clean build
```

Windowsでは`gradlew.bat clean build`を実行します。生成されるJARは`plugin/build/libs/DiscordGate-1.0.4.jar`です。JARをMinecraftサーバーの`plugins/`へ置いて一度起動し、`plugins/DiscordGate/config.yml`を編集してから再起動します。

```yaml
api-base-url: "https://guildgate-8kl528pa.manus.space"
api-key: "PLUGIN_API_KEYと同じランダムな共有鍵"
connect-timeout-seconds: 3
request-timeout-seconds: 5
```

`api-base-url`はバックエンドHTTPS originで、末尾スラッシュなしです。プラグインはPaperの非同期ログイン前イベントからAPIを呼び出し、`ALLOW`だけを許可します。未認証時はドメインと本人用の短い認証コードで案内し、Discord認証が完了するまで接続を拒否します。接続API・Discord APIのエラー、不正な応答、未知の判定は全て拒否します。

## ローカル開発と検証

`.env.example`を参考にしてローカル`.env`を作成し、MySQL互換DBとDiscord設定を入れます。`.env`はGitの対象外です。Node依存の固定にはpnpm 11.25.0を使います。

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm start
```

MinecraftサーバーをVelocityなどのプロキシ越しに動かす場合は、Paperが受け取るUUIDが一貫するようにプロキシ転送を設定してください。開発・テストと公開で同じManaged Databaseを使う場合、テスト時の書込みもそのデータベースへ反映されます。

個別配布ZIPやGitHub Releaseは作成せず、このリポジトリにソースを置きます。
