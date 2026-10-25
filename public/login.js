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
const shortCodePattern = /^\d{4}$/;
const previousSixDigitCodePattern = /^\d{6}$/;
const previousShortCodePattern = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const legacyCodePattern = /^[A-Za-z0-9_-]{32,128}$/;
let code = '';

function normalizeShortCode(value) {
  const normalized = value.trim().replace(/[\s-]/g, '');
  return shortCodePattern.test(normalized) ? normalized : '';
}

function formatCode(value) {
  const shortCode = normalizeShortCode(value);
  if (shortCode) return shortCode;
  if (previousSixDigitCodePattern.test(value)) return `${value.slice(0, 3)} ${value.slice(3)}`;
  if (previousShortCodePattern.test(value)) return value.match(/.{4}/g)?.join('-') || value;
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
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
    tokenValue.textContent = formatCode(code);
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
    feedback.textContent = '4桁コードを確認しました。Discord公式画面へ進めます。';
    return;
  }

  code = '';
  button.disabled = true;
  label.textContent = '4桁コードを入力してください';
  const compact = codeInput.value.trim().replace(/[\s-]/g, '');
  feedback.classList.remove('is-error');
  feedback.textContent = compact.length === 0
    ? 'Minecraft画面に表示された4桁の数字を入力してください。'
    : /^\d+$/.test(compact) && compact.length < 4
      ? `あと${4 - compact.length}桁入力してください。`
      : 'コードは半角数字4桁で入力してください。';
}

function beginAuthorization() {
  if (button.disabled || !code) return;
  button.disabled = true;
  label.textContent = 'Discordへ接続中…';
  feedback.classList.remove('is-error');
  feedback.textContent = '認証コードを確認しています。';

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

    const normalizedPreviousDigits = queryCode.trim().replace(/[\s-]/g, '');
    if (previousSixDigitCodePattern.test(normalizedPreviousDigits)) {
      setReady(normalizedPreviousDigits, true);
      return;
    }

    const normalizedPreviousCode = queryCode.trim().toUpperCase().replace(/[\s-]/g, '');
    if (previousShortCodePattern.test(normalizedPreviousCode)) {
      setReady(normalizedPreviousCode, true);
      return;
    }
    if (legacyCodePattern.test(queryCode)) {
      setReady(queryCode, true);
      return;
    }
    feedback.textContent = 'URL内のコードが無効か期限切れです。Minecraft画面の新しい4桁コードを入力してください。';
    feedback.classList.add('is-error');
  } else {
    feedback.textContent = 'Minecraft画面に表示された4桁の数字を入力してください。';
  }

  codeEntry.hidden = false;
  button.disabled = true;
  label.textContent = '4桁コードを入力してください';
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
