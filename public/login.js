const button = document.querySelector('#auth-button');
const label = document.querySelector('#button-label');
const feedback = document.querySelector('#feedback');
const tokenBox = document.querySelector('#player-token');
const tokenValue = document.querySelector('#token-value');
const codeEntry = document.querySelector('#code-entry');
const codeInput = document.querySelector('#manual-code');
const params = new URLSearchParams(window.location.search);
const queryCode = params.get('code') || '';
const apiBaseUrl = String(window.DISCORD_GATE_CONFIG?.apiBaseUrl || '').trim().replace(/\/+$/, '');
const shortCodePattern = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/;
const legacyCodePattern = /^[A-Za-z0-9_-]{32,128}$/;
let code = '';

function normalizeShortCode(value) {
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return shortCodePattern.test(normalized) ? normalized : '';
}

function formatShortCode(value) {
  return value.match(/.{4}/g)?.join('-') || value;
}

function showError(message) {
  feedback.textContent = message;
  feedback.classList.add('is-error');
  button.disabled = true;
  label.textContent = '認証を開始できません';
}

function setReady(value, fromQuery = false) {
  code = value;
  button.disabled = false;
  label.textContent = 'Discordで認証する';
  feedback.classList.remove('is-error');
  feedback.textContent = 'Discord公式画面へ移動してアカウントを認証します。';

  if (fromQuery) {
    codeEntry.hidden = true;
    tokenBox.hidden = false;
    tokenValue.textContent = shortCodePattern.test(code)
      ? formatShortCode(code)
      : `${code.slice(0, 7)}…${code.slice(-5)}`;
    // Remove any legacy bearer-like query token from the visible address/history.
    window.history.replaceState(null, '', window.location.pathname);
  }
}

function handleCodeInput() {
  if (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl)) {
    code = '';
    showError('認証APIがまだ設定されていません。サーバー管理者に連絡してください。');
    return;
  }

  const normalized = normalizeShortCode(codeInput.value);
  if (normalized) {
    code = normalized;
    button.disabled = false;
    label.textContent = 'Discordで認証する';
    feedback.classList.remove('is-error');
    feedback.textContent = 'コードを確認しました。Discord公式画面へ進めます。';
    return;
  }

  code = '';
  button.disabled = true;
  label.textContent = '認証コードを入力してください';
  const compact = codeInput.value.trim().toUpperCase().replace(/[\s-]/g, '');
  feedback.classList.remove('is-error');
  feedback.textContent = compact.length === 0
    ? 'Minecraft画面に表示された16文字のコードを入力してください。'
    : compact.length < 16
      ? `あと${16 - compact.length}文字入力してください。`
      : 'コードの文字を確認してください（0〜9、A〜H、J〜K、M〜N、P〜T、V〜Z）。';
}

function beginAuthorization() {
  if (button.disabled || !code) return;
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
  if (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl)) {
    showError('認証APIがまだ設定されていません。サーバー管理者に連絡してください。');
    return;
  }

  if (queryCode) {
    const normalizedShortCode = normalizeShortCode(queryCode);
    if (normalizedShortCode) {
      setReady(normalizedShortCode, true);
      return;
    }
    if (legacyCodePattern.test(queryCode)) {
      setReady(queryCode, true);
      return;
    }
    feedback.textContent = 'URL内のコードが無効か期限切れです。Minecraft画面の新しいコードを入力してください。';
    feedback.classList.add('is-error');
  } else {
    feedback.textContent = 'Minecraft画面に表示された16文字のコードを入力してください。';
  }

  codeEntry.hidden = false;
  button.disabled = true;
  label.textContent = '認証コードを入力してください';
  codeInput.focus({ preventScroll: true });
}

button.addEventListener('click', beginAuthorization);
codeInput.addEventListener('input', handleCodeInput);
codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !button.disabled) {
    event.preventDefault();
    beginAuthorization();
  }
});
prepare();
