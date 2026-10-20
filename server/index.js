import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import {
  pool,
  ensureSchema,
  hashOpaque,
  newOpaqueToken,
  getLinkedAccount,
  createPendingLink,
  getPendingLinkByCodeHash,
  createOAuthState,
  consumeOAuthState,
  saveLinkedAccount,
} from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const defaultPublicSiteUrl = 'https://mikanzaki.github.io/minecraft';
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  frameguard: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://discord.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: '4kb', type: 'application/x-www-form-urlencoded' }));

function appBaseUrl() {
  let value = process.env.APP_BASE_URL;
  if (!value && !production) value = 'http://localhost:3000';
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return null;
    if (production && url.protocol !== 'https:') return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function publicSiteBaseUrl() {
  const value = process.env.PUBLIC_SITE_URL || defaultPublicSiteUrl;
  try {
    const url = new URL(value);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return null;
    if (production && url.protocol !== 'https:') return null;
    if (url.search || url.hash) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function publicPageUrl(page) {
  const base = publicSiteBaseUrl();
  if (!base || !/^[a-z0-9.-]+\.html$/i.test(page)) return null;
  return `${base}/${page}`;
}

function oauthConfigured() {
  return Boolean(
    appBaseUrl()
    && publicSiteBaseUrl()
    && process.env.DISCORD_CLIENT_ID
    && process.env.DISCORD_CLIENT_SECRET
    && process.env.DISCORD_BOT_TOKEN
    && /^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID || '')
    && (process.env.PLUGIN_API_KEY || '').length >= 32,
  );
}

function safeEqual(left, right) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function pluginAuthorization(req, res, next) {
  const expected = process.env.PLUGIN_API_KEY || '';
  const header = req.get('authorization') || '';
  const match = /^Bearer ([\x21-\x7e]{1,512})$/.exec(header);
  if (expected.length < 32 || !match || !safeEqual(match[1], expected)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  const pageUrl = publicSiteBaseUrl();
  const allowedOrigins = new Set();
  if (pageUrl) allowedOrigins.add(new URL(pageUrl).origin);
  if (!production && appBaseUrl()) allowedOrigins.add(appBaseUrl());
  try {
    if (!origin || !allowedOrigins.has(new URL(origin).origin)) {
      return resultPage(res, 'service_error');
    }
  } catch {
    return resultPage(res, 'service_error');
  }
  return next();
}

function oauthCookieName(state) {
  return `dg_oauth_${hashOpaque(state).slice(0, 24)}`;
}

function setOAuthStateCookie(res, state) {
  const secure = appBaseUrl()?.startsWith('https://') ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${oauthCookieName(state)}=${encodeURIComponent(state)}; Path=/oauth/callback; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
  );
}

function clearOAuthStateCookie(res, state) {
  const secure = appBaseUrl()?.startsWith('https://') ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${oauthCookieName(state)}=; Path=/oauth/callback; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
  );
}

function hasOAuthStateCookie(req, state) {
  const name = oauthCookieName(state);
  const cookies = (req.headers.cookie || '').split(';');
  for (const entry of cookies) {
    const separator = entry.indexOf('=');
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    try {
      return safeEqual(decodeURIComponent(entry.slice(separator + 1).trim()), state);
    } catch {
      return false;
    }
  }
  return false;
}

function canonicalUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readDiscordResponse(response) {
  const text = await response.text();
  if (text.length > 65536) throw new Error('discord_response_too_large');
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('discord_response_invalid');
  }
  return data;
}

async function discordGuildMembership(discordUserId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) throw new Error('discord_membership_not_configured');

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}`,
    {
      method: 'GET',
      headers: { authorization: `Bot ${botToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (response.status === 200 || response.status === 404) {
    await response.body?.cancel().catch(() => {});
    return response.status === 200;
  }
  await response.body?.cancel().catch(() => {});
  throw new Error(`discord_membership_http_${response.status}`);
}

async function exchangeDiscordCode(code) {
  const callbackUrl = `${appBaseUrl()}/oauth/callback`;
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  });
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const data = await readDiscordResponse(response);
  if (!response.ok || !data.access_token) throw new Error('discord_token_exchange_failed');
  return data.access_token;
}

async function discordIdentity(accessToken) {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  const data = await readDiscordResponse(response);
  if (!response.ok || !/^\d{17,20}$/.test(data.id || '')) throw new Error('discord_identity_lookup_failed');
  const username = typeof data.global_name === 'string' && data.global_name
    ? data.global_name
    : (typeof data.username === 'string' ? data.username : 'Discord user');
  return { id: data.id, username: username.slice(0, 100) };
}

function resultPage(res, status) {
  const page = publicPageUrl('result.html');
  if (!page) return res.status(503).json({ error: 'public_site_not_configured' });
  const target = new URL(page);
  target.searchParams.set('status', status);
  return res.redirect(303, target.toString());
}

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});

app.post('/api/v1/check', pluginAuthorization, async (req, res) => {
  const uuid = req.body?.uuid;
  const username = req.body?.username;
  if (!canonicalUuid(uuid) || typeof username !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(username)) {
    return res.status(400).json({ error: 'invalid_player' });
  }

  try {
    const linked = await getLinkedAccount(uuid.toLowerCase());
    if (linked) {
      const isMember = await discordGuildMembership(linked.discord_user_id);
      if (!isMember) return res.status(200).json({ status: 'GUILD_REQUIRED' });
      return res.status(200).json({ status: 'ALLOW' });
    }

    const page = publicPageUrl('login.html');
    if (!page) return res.status(503).json({ status: 'TEMPORARY_ERROR' });
    const pending = await createPendingLink(uuid.toLowerCase(), username);
    const loginUrl = new URL(page);
    loginUrl.searchParams.set('code', pending.token);
    return res.status(200).json({ status: 'LINK_REQUIRED', url: loginUrl.toString() });
  } catch {
    return res.status(503).json({ status: 'TEMPORARY_ERROR' });
  }
});

const authStartLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => resultPage(res, 'service_error'),
});

app.post('/api/auth/start', sameOriginOnly, authStartLimiter, async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string' || code.length < 32 || code.length > 128) {
    return resultPage(res, 'expired');
  }
  if (!oauthConfigured()) return resultPage(res, 'service_setup');

  try {
    const pending = await getPendingLinkByCodeHash(hashOpaque(code));
    if (!pending) return resultPage(res, 'expired');
    const state = newOpaqueToken();
    await createOAuthState(state, pending);
    setOAuthStateCookie(res, state);

    const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
    authorizeUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', `${appBaseUrl()}/oauth/callback`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'identify');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('prompt', 'consent');
    return res.redirect(303, authorizeUrl.toString());
  } catch {
    return resultPage(res, 'service_error');
  }
});

app.get('/oauth/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (state.length < 32 || state.length > 128) return resultPage(res, 'expired');
  const stateCookieMatches = hasOAuthStateCookie(req, state);
  clearOAuthStateCookie(res, state);
  if (!stateCookieMatches) return resultPage(res, 'expired');

  let flow;
  try {
    flow = await consumeOAuthState(state);
  } catch {
    return resultPage(res, 'service_error');
  }
  if (!flow) return resultPage(res, 'expired');
  if (req.query.error) return resultPage(res, 'cancelled');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code || code.length > 2048) return resultPage(res, 'service_error');
  if (!oauthConfigured()) return resultPage(res, 'service_setup');

  try {
    const accessToken = await exchangeDiscordCode(code);
    const identity = await discordIdentity(accessToken);
    const isMember = await discordGuildMembership(identity.id);
    if (!isMember) return resultPage(res, 'join_required');

    const outcome = await saveLinkedAccount(
      flow.minecraft_uuid,
      flow.code_hash,
      identity.id,
      identity.username,
    );
    if (outcome === 'already_linked') return resultPage(res, 'already_linked');
    if (outcome === 'expired') return resultPage(res, 'expired');
    return resultPage(res, 'success');
  } catch {
    return resultPage(res, 'service_error');
  }
});

app.get('/', (_req, res) => {
  const base = publicSiteBaseUrl();
  if (!base) return res.status(503).json({ error: 'public_site_not_configured' });
  return res.redirect(302, `${base}/`);
});
app.use(express.static('public', {
  dotfiles: 'deny',
  fallthrough: true,
  index: false,
  maxAge: production ? '5m' : 0,
  setHeaders(res, path) {
    if (path.endsWith('.html') || path.endsWith('manus-routes.json') || path.endsWith('config.js')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
  return res.status(500).json({ error: 'internal_error' });
});

await ensureSchema();
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`DiscordGate auth service listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
