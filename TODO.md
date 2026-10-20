# 実装項目

- [ ] PaperプラグインでDiscord認証と対象サーバー在籍を確認する。
  - 特定のDiscordサーバーに参加している場合だけ、Minecraftサーバーにアクセスできる。
  - 特定のDiscordサーバーに参加していない場合は、Minecraftサーバーにアクセスできない。
  - Discord認証と在籍条件を満たした後、Minecraftサーバーへ再参加すると接続できる。
  - Discord確認サービスや通信が失敗した場合も接続を拒否する。

- [ ] 未認証プレイヤーにブラウザー認証リンクを案内する。
  - Minecraftの画面に「[https://〇〇〇〇/でDiscord認証を行ってください](https://%E3%80%87%E3%80%87%E3%80%87%E3%80%87/%E3%81%A7Discord%E8%AA%8D%E8%A8%BC%E3%82%92%E8%A1%8C%E3%81%A3%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84) 。」に相当する案内を表示する。
  - Minecraft上のリンク文字列は`https://discord.yydassai.f5.si/`だけにする 。
  - 切断画面に本人専用の16文字、一回限りで15分有効な認証コードを表示する。QRコードは表示しない。
  - プレイヤーは`https://discord.yydassai.f5.si/`を開き、`login.html`でその短い認証コードを入力してDiscord認証を開始できる。長い`login.html?code=...`のURLを入力する必要はない。
  - Discord認証が完了するまではMinecraftへの接続を拒否する。
  - 認証完了後にMinecraftへ再参加すると、対象Discordサーバーに参加しているプレイヤーだけ接続できる。

- [ ] Discord OAuth認証とMinecraftアカウント連携を実装する。
  - Discord認証で本人のDiscord IDを確認し、Minecraft UUIDと永続的に連携する。
  - 対象DiscordサーバーIDは`1550163473982300392`を使う。
  - 対象Discordサーバーに未参加なら接続を認めず、参加後の再接続を案内する。
  - 接続判定のたびに対象Discordサーバーへの在籍を確認する。
- [ ] OAuthの失敗段階を安全に診断できる。
  - サーバーログには失敗箇所だけを記録し、Client Secret・Bot Token・OAuth token/state・Minecraft認証コード・UUIDを記録しない。

- [ ] 公開サイトと認証バックエンドを分離して公開する。
  - `mikanzaki/minecraft`の公開GitHubリポジトリにソースを置き、GitHub Pagesで`login.html`を公開する。
  - GitHub Pagesには静的ファイルを置き、OAuth秘密鍵・Bot Token・認証DB・接続APIは別サーバー側に置く。
  - 認証APIの公開originは`https://guildgate-8kl528pa.manus.space`、ログインサイトは`https://discord.yydassai.f5.si`とする 。
  - Discord秘密情報と共有API鍵は公開リポジトリへ含めない。

- [x] 認証サイトは青色をメインカラーとし、背景・アクセント・認証ボタンに青系配色を使う。

- [x] `login.html`をもっとカッコよく見やすくする。
  - 青をメインカラーに保ち、主要見出し・認証ボタン・認証後の再接続手順が見やすい。
  - 日本語の案内を中心にし、Discord認証の流れが理解しやすい。

- [ ] 最新Paper/Minecraft版向けのビルドと導入手順を整える。
  - 現行Paper APIに対応するプラグインソースとビルド可能な構成を用意する。
  - Discordアプリ、対象Guild、OAuth Redirect URI、Web API URL、共有API鍵の設定方法を明記する。
  - 個別の配布ZIPやGitHub Releaseは作らず、依頼者指定のGitHubリポジトリへソースを置く。
