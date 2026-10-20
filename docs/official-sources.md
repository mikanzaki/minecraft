# 参照した公式仕様

GitHub公式ドキュメントでは、PagesはHTML・CSS・JavaScriptをリポジトリから配信する静的ホスティングと説明されています。ユーザー/組織サイトとリポジトリごとのProjectサイトがあり、Projectサイトの標準URLは`https://<owner>.github.io/<repository>`です。したがって`mikanzaki/minecraft`の標準URLは`https://mikanzaki.github.io/minecraft`です。[GitHub Pagesとは](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)

GitHub公式の公開元設定は、ブランチ/フォルダーまたはGitHub Actionsを使えます。公式の現行静的サイトワークフローは`actions/checkout@v4`、`actions/configure-pages@v5`、`actions/upload-pages-artifact@v3`、`actions/deploy-pages@v5`を用い、`contents: read`、`pages: write`、`id-token: write`の権限を指定します。[公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) [公式starter workflow](https://github.com/actions/starter-workflows/blob/main/pages/static.yml)

Paper公式ダウンロードと開発セットアップの2026年10月20日時点の資料はPaper 26.2とJava 25ツールチェーンを案内しています。プラグインの`plugin.yml` API versionもPaper公式仕様に合わせています。[Paperダウンロード](https://papermc.io/downloads/paper) [Paperプロジェクト設定](https://docs.papermc.io/paper/dev/project-setup/) [plugin.yml仕様](https://docs.papermc.io/paper/dev/plugin-yml/)

Discord OAuthは`identify` scopeで現在のユーザーを取得し、指定サーバーへの在籍はBot認証のGuild member endpointで検証します。[Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) [User API](https://docs.discord.com/developers/resources/user) [Guild API](https://docs.discord.com/developers/resources/guild)
