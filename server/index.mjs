import { createServer as createHttpServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 5173);
const DATA_FILE = resolve(process.env.NETS_DATA_FILE || join(ROOT, 'server', 'data', 'auth-store.json'));
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_OTP_ATTEMPTS = 5;
const IP_LOGIN_LIMIT = 30;
const IP_RECOVERY_LIMIT = 10;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const EXPOSE_DEMO_OTP = !IS_PRODUCTION && process.env.EXPOSE_DEMO_OTP !== 'false';
const rateWindows = new Map();

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production. Use at least 32 random bytes.');
}

const DEVELOPMENT_DEMO_USERS = [
  { id: '1', loginId: 'alexchen140896', name: 'Alex Chen', phone: '+65 9123 4567', pin: '111111', isAdmin: false },
  { id: '2', loginId: 'sarahtan230394', name: 'Sarah Tan', phone: '+65 9234 5678', pin: '222222', isAdmin: false },
  { id: '3', loginId: 'mikewong081192', name: 'Mike Wong', phone: '+65 9345 6789', pin: '333333', isAdmin: false },
  { id: '4', loginId: 'jennylim170797', name: 'Jenny Lim', phone: '+65 9456 7890', pin: '444444', isAdmin: false },
  { id: 'admin', loginId: 'admin010180', name: 'Admin (Management)', phone: 'Management Portal', pin: '888888', isAdmin: true },
  { id: 'merchant-kopi', loginId: 'kopitiammerchant', name: 'Kopitiam Merchant', phone: 'Merchant Portal', pin: '555555', isAdmin: false, role: 'merchant', merchantId: 'kopi' },
];

function normalizeLoginId(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(pin), salt, 64, { cost: 16384, blockSize: 8, parallelization: 1 });
  return { salt, hash: hash.toString('hex') };
}

function verifyPin(pin, credential) {
  if (!credential?.salt || !credential?.hash) return false;
  const expected = Buffer.from(credential.hash, 'hex');
  const actual = scryptSync(String(pin), credential.salt, expected.length, { cost: 16384, blockSize: 8, parallelization: 1 });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const DUMMY_CREDENTIAL = hashPin(randomBytes(18).toString('hex'));

function consumeRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  current.count += 1;
  return current.count > limit ? Math.ceil((current.resetAt - now) / 1000) : 0;
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function otpDigest(challengeId, code) {
  return createHmac('sha256', SESSION_SECRET).update(`${challengeId}:${code}`).digest('hex');
}

function safeEqualHex(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function makeInitialStore() {
  let seedUsers = DEVELOPMENT_DEMO_USERS;
  if (IS_PRODUCTION) {
    try {
      seedUsers = JSON.parse(process.env.NETS_SEED_USERS_JSON || '[]');
    } catch {
      throw new Error('NETS_SEED_USERS_JSON must be valid JSON.');
    }
    if (!Array.isArray(seedUsers) || seedUsers.length === 0 || seedUsers.some((user) => !user.id || !user.loginId || !/^\d{6}$/.test(user.pin))) {
      throw new Error('A new production store requires NETS_SEED_USERS_JSON with valid users and six-digit initial PINs.');
    }
  }
  return {
    version: 1,
    users: seedUsers.map(({ pin, ...user }) => ({ ...user, credential: hashPin(pin), failedAttempts: 0, lockedUntil: 0 })),
    sessions: {},
    challenges: {},
    resetTokens: {},
    sync: { revision: 0, updatedAt: 0, updatedBy: null, sqlite: null },
    audit: [],
  };
}

function loadStore() {
  if (process.env.RESET_DEMO_DATA === 'true' || !existsSync(DATA_FILE)) return makeInitialStore();
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    return parsed?.version === 1 ? parsed : makeInitialStore();
  } catch (error) {
    console.warn('Could not read auth store; starting with a fresh demo store.', error);
    return makeInitialStore();
  }
}

let store = loadStore();

function persist() {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const temporary = `${DATA_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
  renameSync(temporary, DATA_FILE);
}

// Add newly introduced demo roles without resetting PINs or sessions belonging
// to existing development accounts.
if (!IS_PRODUCTION) {
  let addedDemoUser = false;
  for (const { pin, ...candidate } of DEVELOPMENT_DEMO_USERS) {
    if (store.users.some((user) => user.id === candidate.id)) continue;
    store.users.push({ ...candidate, credential: hashPin(pin), failedAttempts: 0, lockedUntil: 0 });
    addedDemoUser = true;
  }
  if (addedDemoUser) persist();
}

function cleanExpired(now = Date.now()) {
  let changed = false;
  for (const [key, session] of Object.entries(store.sessions)) {
    if (session.expiresAt <= now) { delete store.sessions[key]; changed = true; }
  }
  for (const [key, challenge] of Object.entries(store.challenges)) {
    if (challenge.expiresAt <= now) { delete store.challenges[key]; changed = true; }
  }
  for (const [key, token] of Object.entries(store.resetTokens)) {
    if (token.expiresAt <= now) { delete store.resetTokens[key]; changed = true; }
  }
  if (changed) persist();
}

function audit(type, details = {}) {
  store.audit.push({ type, at: new Date().toISOString(), ...details });
  store.audit = store.audit.slice(-500);
}

function publicUser(user) {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    phone: user.phone,
    isAdmin: user.isAdmin,
    role: user.role ?? (user.isAdmin ? 'admin' : 'customer'),
    merchantId: user.merchantId,
  };
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=');
    return [name, decodeURIComponent(rest.join('='))];
  }).filter(([name]) => name));
}

function getSession(req) {
  cleanExpired();
  const raw = parseCookies(req).nets_sid;
  if (!raw) return null;
  const session = store.sessions[digest(raw)];
  if (!session || session.expiresAt <= Date.now()) return null;
  const user = store.users.find((candidate) => candidate.id === session.userId);
  return user ? { raw, session, user } : null;
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://sandbox.nets.openapipaas.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(body));
}

function getClientAddress(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function validateMutation(req, res) {
  if (req.headers['x-nets-csrf'] !== '1') {
    json(res, 403, { error: 'Request verification failed.' });
    return false;
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        json(res, 403, { error: 'Cross-origin request blocked.' });
        return false;
      }
    } catch {
      json(res, 403, { error: 'Invalid request origin.' });
      return false;
    }
  }
  return true;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function issueSession(userId, req) {
  const raw = randomBytes(32).toString('base64url');
  store.sessions[digest(raw)] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ipHash: digest(getClientAddress(req)).slice(0, 16),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
  };
  return raw;
}

function sessionCookie(raw, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  return `nets_sid=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeSeconds)}${secure}`;
}

function isAcceptablePin(pin) {
  return /^\d{6}$/.test(pin) && !/^(\d)\1{5}$/.test(pin) && !['123456', '654321'].includes(pin);
}

async function deliverOtp({ challengeId, code, user }) {
  const webhook = process.env.OTP_WEBHOOK_URL;
  if (!webhook) {
    if (IS_PRODUCTION) throw new Error('OTP_WEBHOOK_URL is required in production.');
    console.info(`[NETS development OTP] ${user.loginId}: ${code}`);
    return;
  }
  const response = await fetch(webhook, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OTP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.OTP_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ challengeId, destination: user.phone, message: `Your NETS verification code is ${code}. It expires in 5 minutes.` }),
  });
  if (!response.ok) throw new Error(`OTP provider returned ${response.status}`);
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, { ok: true, auth: 'server', sync: 'server', version: 1 });
  }

  if (url.pathname === '/api/session' && req.method === 'GET') {
    const current = getSession(req);
    return current ? json(res, 200, { authenticated: true, user: publicUser(current.user) }) : json(res, 200, { authenticated: false });
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !validateMutation(req, res)) return;

  if (url.pathname === '/api/test/reset' && req.method === 'POST' && process.env.RESET_DEMO_DATA === 'true') {
    store = makeInitialStore();
    rateWindows.clear();
    persist();
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJson(req);
    const loginId = normalizeLoginId(body.loginId);
    const pin = String(body.pin || '');
    const addressHash = digest(getClientAddress(req)).slice(0, 16);
    const loginLimit = process.env.RESET_DEMO_DATA === 'true' ? 500 : IP_LOGIN_LIMIT;
    const ipRetryAfter = consumeRateLimit(`login:${addressHash}`, loginLimit, LOCKOUT_MS);
    if (ipRetryAfter) return json(res, 429, { error: 'We could not sign you in. Try again later.', retryAfter: ipRetryAfter });
    const user = store.users.find((candidate) => normalizeLoginId(candidate.loginId) === loginId);
    const now = Date.now();

    if (user?.lockedUntil > now) {
      audit('login_locked', { loginId: digest(loginId).slice(0, 16), ip: digest(getClientAddress(req)).slice(0, 16) });
      persist();
      return json(res, 429, { error: 'We could not sign you in. Try again later.', retryAfter: Math.ceil((user.lockedUntil - now) / 1000) });
    }

    const pinMatches = verifyPin(pin, user?.credential || DUMMY_CREDENTIAL);
    const valid = Boolean(user && /^\d{6}$/.test(pin) && pinMatches);
    if (!valid) {
      if (user) {
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) user.lockedUntil = now + LOCKOUT_MS;
      }
      audit('login_failed', { loginId: digest(loginId).slice(0, 16), ip: digest(getClientAddress(req)).slice(0, 16) });
      persist();
      const retryAfter = user?.lockedUntil > now ? Math.ceil((user.lockedUntil - now) / 1000) : undefined;
      return json(res, retryAfter ? 429 : 401, { error: 'We could not match those sign-in details.', retryAfter });
    }

    user.failedAttempts = 0;
    user.lockedUntil = 0;
    const session = issueSession(user.id, req);
    audit('login_succeeded', { userId: user.id, ip: digest(getClientAddress(req)).slice(0, 16) });
    persist();
    return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) });
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const current = getSession(req);
    if (current) delete store.sessions[digest(current.raw)];
    audit('logout', { userId: current?.user.id || null });
    persist();
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (url.pathname === '/api/auth/recovery/start' && req.method === 'POST') {
    const body = await readJson(req);
    const addressHash = digest(getClientAddress(req)).slice(0, 16);
    const retryAfter = consumeRateLimit(`recovery:${addressHash}`, IP_RECOVERY_LIMIT, 60 * 60 * 1000);
    if (retryAfter) return json(res, 429, { error: 'Too many recovery requests. Try again later.', retryAfter });
    const loginId = normalizeLoginId(body.loginId);
    const phone = normalizePhone(body.phone);
    const user = store.users.find((candidate) => normalizeLoginId(candidate.loginId) === loginId && normalizePhone(candidate.phone) === phone);
    const challengeId = randomBytes(24).toString('base64url');
    const code = String(100000 + Number(BigInt(`0x${randomBytes(4).toString('hex')}`) % 900000n));
    store.challenges[challengeId] = {
      userId: user?.id || null,
      codeHash: otpDigest(challengeId, code),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      verified: false,
    };
    audit('recovery_started', { accountMatched: Boolean(user), ip: digest(getClientAddress(req)).slice(0, 16) });
    persist();

    if (user) {
      try {
        await deliverOtp({ challengeId, code, user });
      } catch (error) {
        console.error('OTP delivery failed:', error);
        return json(res, 503, { error: 'Verification delivery is temporarily unavailable. Please try again.' });
      }
    }

    return json(res, 202, {
      challengeId,
      destination: user ? `•••• ${normalizePhone(user.phone).slice(-4)}` : 'your registered mobile number',
      expiresIn: OTP_TTL_MS / 1000,
      ...(user && EXPOSE_DEMO_OTP ? { demoCode: code } : {}),
    });
  }

  if (url.pathname === '/api/auth/recovery/verify' && req.method === 'POST') {
    const body = await readJson(req);
    const challenge = store.challenges[String(body.challengeId || '')];
    const supplied = otpDigest(String(body.challengeId || ''), String(body.code || ''));
    if (!challenge || challenge.expiresAt <= Date.now() || challenge.attempts >= MAX_OTP_ATTEMPTS || !challenge.userId) {
      return json(res, 400, { error: 'That verification code is invalid or has expired.' });
    }
    challenge.attempts += 1;
    if (!safeEqualHex(challenge.codeHash, supplied)) {
      audit('recovery_code_failed', { userId: challenge.userId });
      persist();
      return json(res, 400, { error: 'That verification code is invalid or has expired.' });
    }
    challenge.verified = true;
    const rawResetToken = randomBytes(32).toString('base64url');
    store.resetTokens[digest(rawResetToken)] = { userId: challenge.userId, expiresAt: Date.now() + RESET_TTL_MS };
    delete store.challenges[String(body.challengeId)];
    audit('recovery_verified', { userId: challenge.userId });
    persist();
    return json(res, 200, { resetToken: rawResetToken, expiresIn: RESET_TTL_MS / 1000 });
  }

  if (url.pathname === '/api/auth/recovery/reset' && req.method === 'POST') {
    const body = await readJson(req);
    const tokenKey = digest(String(body.resetToken || ''));
    const token = store.resetTokens[tokenKey];
    const pin = String(body.newPin || '');
    if (!token || token.expiresAt <= Date.now()) return json(res, 400, { error: 'Your reset session has expired. Start again.' });
    if (!isAcceptablePin(pin)) return json(res, 400, { error: 'Choose six digits that are not repeated or sequential.' });
    const user = store.users.find((candidate) => candidate.id === token.userId);
    if (!user) return json(res, 400, { error: 'Your reset session has expired. Start again.' });
    user.credential = hashPin(pin);
    user.failedAttempts = 0;
    user.lockedUntil = 0;
    delete store.resetTokens[tokenKey];
    for (const [key, session] of Object.entries(store.sessions)) {
      if (session.userId === user.id) delete store.sessions[key];
    }
    audit('pin_reset', { userId: user.id });
    persist();
    return json(res, 200, { ok: true });
  }

  const current = getSession(req);
  if (!current) return json(res, 401, { error: 'Your session has expired. Please sign in again.' });

  if (url.pathname === '/api/auth/change-pin' && req.method === 'POST') {
    const body = await readJson(req);
    const currentPin = String(body.currentPin || '');
    const newPin = String(body.newPin || '');
    if (!verifyPin(currentPin, current.user.credential)) return json(res, 400, { error: 'Your current PIN is incorrect.' });
    if (!isAcceptablePin(newPin) || newPin === currentPin) return json(res, 400, { error: 'Choose a different six-digit PIN that is not repeated or sequential.' });
    current.user.credential = hashPin(newPin);
    for (const [key, session] of Object.entries(store.sessions)) {
      if (session.userId === current.user.id && key !== digest(current.raw)) delete store.sessions[key];
    }
    audit('pin_changed', { userId: current.user.id });
    persist();
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/sync/state' && req.method === 'GET') {
    return json(res, 200, store.sync);
  }

  if (url.pathname === '/api/sync/state' && req.method === 'PUT') {
    const body = await readJson(req);
    if (typeof body.sqlite !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.sqlite) || body.sqlite.length > MAX_BODY_BYTES) {
      return json(res, 400, { error: 'Invalid synchronized database payload.' });
    }
    const expectedRevision = Number(body.revision || 0);
    if (expectedRevision !== store.sync.revision) return json(res, 409, { error: 'A newer copy is available.', state: store.sync });
    store.sync = { revision: store.sync.revision + 1, updatedAt: Date.now(), updatedBy: current.user.id, sqlite: body.sqlite };
    audit('state_synchronized', { userId: current.user.id, revision: store.sync.revision });
    persist();
    return json(res, 200, { revision: store.sync.revision, updatedAt: store.sync.updatedAt });
  }

  return json(res, 404, { error: 'API route not found.' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};

function serveProduction(req, res, url) {
  const dist = join(ROOT, 'dist');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const candidate = normalize(join(dist, pathname));
  const file = candidate.startsWith(dist) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(dist, 'index.html');
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  const refreshable = file.endsWith('index.html') || file.endsWith('sw.js') || file.endsWith('.webmanifest');
  const fingerprinted = file.includes(`${join('dist', 'assets')}`);
  res.setHeader('Cache-Control', refreshable
    ? 'no-cache'
    : fingerprinted ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  createReadStream(file).pipe(res);
}

let vite;
if (!IS_PRODUCTION) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'spa' });
}

persist();
const server = createHttpServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (vite) return vite.middlewares(req, res, (error) => {
      if (error) { console.error(error); json(res, 500, { error: 'Development server error.' }); }
    });
    return serveProduction(req, res, url);
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'Request payload is too large.' });
    if (error instanceof SyntaxError) return json(res, 400, { error: 'Invalid JSON request.' });
    console.error(error);
    return json(res, 500, { error: 'Unexpected server error.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.info(`NETS ${IS_PRODUCTION ? 'production' : 'development'} server listening on http://localhost:${PORT}`);
  if (!IS_PRODUCTION && !process.env.SESSION_SECRET) console.info('Using an ephemeral development session secret.');
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
