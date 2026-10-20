const messages = {
  success: {
    code: 'ACCESS LINKED / 200',
    title: 'Discord認証が完了しました。',
    message: 'DiscordアカウントとMinecraftアカウントを連携しました。Minecraftサーバーへ戻り、もう一度接続してください。',
    status: 'LINKED',
    ok: true,
  },
  join_required: {
    code: 'GUILD MEMBERSHIP REQUIRED / 403',
    title: 'Discordサーバーへの参加が必要です。',
    message: '指定されたDiscordサーバーに参加した後、Minecraftサーバーへ再接続してください。参加状態を確認して接続を許可します。',
    status: 'JOIN REQUIRED',
  },
  already_linked: {
    code: 'ACCOUNT LINK CONFLICT / 409',
    title: 'このDiscordアカウントは使用できません。',
    message: 'このDiscordアカウントは別のMinecraftアカウントに連携済みです。サーバー管理者にお問い合わせください。',
    status: 'CONFLICT',
  },
  cancelled: {
    code: 'AUTHORIZATION CANCELLED',
    title: 'Discord認証がキャンセルされました。',
    message: 'Minecraftサーバーの認証URLをもう一度開き、Discord認証を完了してください。',
    status: 'CANCELLED',
  },
  expired: {
    code: 'LINK EXPIRED / 410',
    title: '認証リンクの有効期限が切れました。',
    message: 'Minecraftサーバーへ再接続し、表示された新しい認証URLからやり直してください。',
    status: 'EXPIRED',
  },
  service_setup: {
    code: 'AUTH SERVICE SETUP REQUIRED',
    title: '認証サービスの設定が完了していません。',
    message: '管理者がDiscord認証情報とバックエンドURLを設定する必要があります。しばらくしてから再度お試しください。',
    status: 'SETUP REQUIRED',
  },
  service_error: {
    code: 'UPSTREAM CHECK FAILED / 503',
    title: '認証を完了できませんでした。',
    message: 'Discordまたは認証サービスとの通信に失敗しました。時間をおいてMinecraftサーバーから再度お試しください。',
    status: 'RETRY REQUIRED',
  },
};

const status = new URLSearchParams(window.location.search).get('status') || 'service_error';
const result = messages[status] || messages.service_error;
document.querySelector('#result-code').textContent = result.code;
document.querySelector('#result-title').textContent = result.title;
document.querySelector('#result-message').textContent = result.message;
document.querySelector('#result-status').textContent = result.status;
document.querySelector('#result-led').style.backgroundColor = result.ok ? '#6cb47e' : '#e34234';
if (!result.ok) {
  const link = document.querySelector('#result-link');
  link.hidden = false;
  link.href = './login.html';
}
