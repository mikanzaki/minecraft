const button = document.querySelector('#auth-button');
const label = document.querySelector('#button-label');
const feedback = document.querySelector('#feedback');
const tokenBox = document.querySelector('#player-token');
const tokenValue = document.querySelector('#token-value');
const params = new URLSearchParams(window.location.search);
const code = params.get('code') || '';
const apiBaseUrl = String(window.DISCORD_GATE_CONFIG?.apiBaseUrl || '').trim().replace(/\/+$/, '');

function showError(message) {
  feedback.textContent = message;
  feedback.classList.add('is-error');
  button.disabled = true;
  label.textContent = '認証を開始できません';
}

function beginAuthorization() {
  if (button.disabled) return;
  button.disabled = true;
  label.textContent = 'Discordへ接続中…';
  feedback.classList.remove('is-error');
  feedback.textContent = '認証リンクを確認しています。';

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${apiBaseUrl}/api/auth/start`;
  form.acceptCharset = 'UTF-8';
  form.hidden = true;

  const codeField = document.createElement('input');
  codeField.type = 'hidden';
  codeField.name = 'code';
  codeField.value = code;
  form.append(codeField);
  document.body.append(form);
  form.submit();
}

function prepare() {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
    return showError('Minecraftサーバーの認証リンクが無効か、リンクの有効期限が切れています。ゲーム内で新しい認証URLを取得してください。');
  }
  if (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl)) {
    return showError('認証APIがまだ設定されていません。サーバー管理者に連絡してください。');
  }

  tokenBox.hidden = false;
  tokenValue.textContent = `${code.slice(0, 7)}…${code.slice(-5)}`;
  button.disabled = false;
  label.textContent = 'Discordで認証する';
  feedback.textContent = 'Discord公式画面へ移動してアカウントを認証します。';

  // Remove the bearer-like one-time code from the visible address/history before leaving this page.
  window.history.replaceState(null, '', window.location.pathname);
}

button.addEventListener('click', beginAuthorization);
prepare();
