const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');

process.chdir(__dirname);
const dataPath = process.env.CLOSET_DATA_PATH || '/data';
fs.mkdirSync(dataPath, { recursive: true });
const options = JSON.parse(fs.readFileSync(path.join(dataPath, 'options.json'), 'utf8'));
if (typeof options.allow_registration !== 'boolean') throw new Error('allow_registration muss true oder false sein.');
const siteUrl = options.site_url || 'http://localhost:3088';
const parsedUrl = new URL(siteUrl);
if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) throw new Error('site_url muss eine HTTP(S)-Adresse ohne Unterpfad sein.');
const secretPath = path.join(dataPath, 'app-secret');
if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, randomBytes(48).toString('hex'), { mode: 0o600, flag: 'wx' });
const child = spawn(process.execPath, ['dist/main.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', HOST: '0.0.0.0', PORT: process.env.CLOSET_PORT || '3000', SITE_URL: parsedUrl.origin,
    APP_NAME: 'Meine Kleidung', DATABASE_TYPE: 'sqlite', DATA_PATH: dataPath,
    DATABASE_SCHEMA: path.join(dataPath, 'sqlite3.db'), FILE_STORAGE_TYPE: 'local',
    AUTH_ENABLED: 'true', DISABLE_REGISTRATION: String(!options.allow_registration),
    SUPPORTER_PROMPT_ENABLED: 'false', PWA_ENABLED: 'false',
    ACCESS_TOKEN_SECRET: fs.readFileSync(secretPath, 'utf8') },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error('App konnte nicht starten:', error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1)));
