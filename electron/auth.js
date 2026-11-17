'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Code en attente de vérification. Volontairement en mémoire : un redémarrage l'invalide. */
let pending = null;
let lastSentAt = 0;
let lastSentEmail = '';

const configPath = () => path.join(app.getPath('userData'), 'auth-config.json');
const sessionPath = () => path.join(app.getPath('userData'), 'auth-session.json');

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
}

function hash(salt, code) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function validEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

async function loadConfig() {
  const config = await readJson(configPath());
  if (!config) return null;
  if (typeof config.apiKey !== 'string' || !config.apiKey) return null;
  if (!validEmail(config.senderEmail)) return null;
  return config;
}

function publicConfig(config) {
  return {
    configured: Boolean(config && config.apiKey && config.senderEmail),
    senderEmail: config?.senderEmail ?? '',
    senderName: config?.senderName ?? '',
  };
}

async function status() {
  const [session, config] = await Promise.all([readJson(sessionPath()), loadConfig()]);
  return {
    authenticated: Boolean(session && typeof session.email === 'string' && session.email),
    email: typeof session?.email === 'string' ? session.email : null,
    configured: Boolean(config),
    senderEmail: config?.senderEmail ?? '',
    // Le mode développement renvoie le code au renderer pour permettre les tests hors ligne.
    dev: !app.isPackaged,
  };
}

function emailBody(code) {
  const minutes = Math.round(CODE_TTL_MS / 60000);
  const text = [
    'Votre code de connexion Editorial Studio',
    '',
    `Code : ${code}`,
    '',
    `Il expire dans ${minutes} minutes.`,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e7f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">Editorial Studio</p>
      <h1 style="margin:0 0 10px;font-size:20px;">Votre code de connexion</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
        Saisissez ce code dans l'application pour ouvrir votre calendrier éditorial.
      </p>
      <div style="margin:0 0 18px;padding:16px;border-radius:12px;background:#eef0ff;text-align:center;">
        <span style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:.28em;color:#4f46e5;">${code}</span>
      </div>
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Ce code expire dans ${minutes} minutes.</p>
      <p style="margin:0;font-size:12px;color:#64748b;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
      </p>
    </div>
  </body>
</html>`;

  return { html, text };
}

async function sendCode(config, to, code) {
  const { html, text } = emailBody(code);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: config.senderEmail, name: config.senderName || 'Editorial Studio' },
      to: [{ email: to }],
      subject: `${code} — connexion à Editorial Studio`,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Envoi refusé par Brevo (${response.status}). ${detail}`);
  }
}

async function requestCode(rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!validEmail(email)) throw new Error('Adresse email invalide.');

  const now = Date.now();
  if (lastSentEmail === email && now - lastSentAt < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: 'Un code vient déjà d’être envoyé.',
      retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000),
    };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  pending = {
    email,
    salt,
    hash: hash(salt, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
  };

  const config = await loadConfig();
  if (!config) {
    if (app.isPackaged) {
      pending = null;
      throw new Error("L'envoi d'emails n'est pas configuré sur cet ordinateur.");
    }
    lastSentAt = now;
    lastSentEmail = email;
    return { ok: true, devCode: code, ttlMinutes: Math.round(CODE_TTL_MS / 60000) };
  }

  try {
    await sendCode(config, email, code);
  } catch (error) {
    pending = null;
    throw error;
  }

  lastSentAt = now;
  lastSentEmail = email;
  return { ok: true, ttlMinutes: Math.round(CODE_TTL_MS / 60000) };
}

async function verifyCode(rawEmail, rawCode) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const code = String(rawCode ?? '').replace(/\s+/g, '');

  if (!pending || pending.email !== email) {
    throw new Error('Demandez un nouveau code de connexion.');
  }
  if (Date.now() > pending.expiresAt) {
    pending = null;
    throw new Error('Ce code a expiré. Demandez-en un nouveau.');
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    pending = null;
    throw new Error('Trop de tentatives. Demandez un nouveau code.');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Le code doit contenir exactement 6 chiffres.');
  }

  const expected = Buffer.from(pending.hash, 'hex');
  const actual = Buffer.from(hash(pending.salt, code), 'hex');
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    pending.attempts += 1;
    const left = Math.max(0, MAX_ATTEMPTS - pending.attempts);
    throw new Error(`Code incorrect. ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.`);
  }

  const now = new Date().toISOString();
  await writeJson(sessionPath(), { email, createdAt: now, lastVerifiedAt: now });
  pending = null;
  return { ok: true, email };
}

async function logout() {
  pending = null;
  await fs.rm(sessionPath(), { force: true });
  return { ok: true };
}

async function configure(input) {
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  const senderEmail =
    typeof input?.senderEmail === 'string' ? input.senderEmail.trim().toLowerCase() : '';
  const senderName =
    typeof input?.senderName === 'string' ? input.senderName.trim().slice(0, 60) : '';

  if (apiKey.length < 10) throw new Error('Clé API Brevo invalide ou trop courte.');
  if (!validEmail(senderEmail)) throw new Error('Adresse expéditrice invalide.');

  const config = { apiKey, senderEmail, senderName };
  await writeJson(configPath(), config);
  return publicConfig(config);
}

async function getPublicConfig() {
  return publicConfig(await loadConfig());
}

module.exports = { status, requestCode, verifyCode, logout, configure, getPublicConfig };
