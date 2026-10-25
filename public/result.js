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
    message: '指定されたDiscordサーバーに参加した後、Minecraftサーバーへ再接続し、新しく表示される4桁コードで認証してください。',
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
    message: 'コードは一度限りです。Minecraftへ再接続して新しい4桁コードを取得し、https://discord.yydassai.f5.si/ で再度認証してください。',
    status: 'CANCELLED',
  },
  expired: {
    code: 'LINK EXPIRED / 410',
    title: '認証コードが無効か、有効期限が切れました。',
    message: 'Minecraftサーバーへ再接続し、表示された新しい4桁コードをこのサイトに入力してください。',
    status: 'EXPIRED',
  },
  rate_limited: {
    code: 'TOO MANY ATTEMPTS / 429',
    title: '入力回数の上限に達しました。',
    message: '同一IPから5分以内に入力できるのは最大3回です。5分待ってからMinecraftへ再接続し、新しい4桁コードでやり直してください。',
    status: 'RATE LIMITED',
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
    message: 'Discordまたは認証サービスとの通信に失敗しました。Minecraftへ再接続して新しい4桁コードを取得し、再度お試しください。繰り返す場合は管理者に連絡してください。',
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
