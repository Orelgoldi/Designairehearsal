require('dotenv').config();
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const app    = express();
const DB     = path.join(__dirname, 'rehearsal.ndjson');
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// email → { name, password }
const SPEAKER_CREDENTIALS = {
  'shellygisser@gmail.com':       { name: 'שלי אור גיסר',         password: 'Shelly' },
  'shira@go-beyondai.com':        { name: 'שירה וינברג הראל',     password: 'Shira' },
  'daniel.boaron2303@gmail.com':  { name: 'דניאל בוארון',         password: 'Daniel' },
  'rbaranov@figma.com':           { name: 'רון ברנוב',            password: 'Ron' },
  'greenshpan.yaakov@gmail.com':  { name: 'ד"ר יעקב גרינשפן',    password: 'Yaakov' },
  'shahar.kgn@gmail.com':         { name: 'שחר קגן',              password: 'Shahar' },
  'berkovitz.inbal@gmail.com':    { name: 'ענבל ברקוביץ',         password: 'Inbal' },
  'galdulev@gmail.com':           { name: 'גל דולב',              password: 'Gal' },
  'zaguri@gmail.com':             { name: 'טל זגורי',             password: 'Tal' },
  'idozaifman@gmail.com':         { name: 'עידו זייפמן וקרן שגב', password: 'Ido' },
};

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'designai7-secret';

function readAll() {
  return fs.readFileSync(DB, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function getAdminToken() {
  const email = process.env.ADMIN_EMAIL    || 'info.aidesign1@gmail.com';
  const pass  = process.env.ADMIN_PASSWORD || 'lukathedog2026';
  return crypto.createHmac('sha256', pass).update(email).digest('hex');
}

function getSpeakerToken(speakerName) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(speakerName).digest('hex');
}

function isAdmin(req) {
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer ') && auth.slice(7) === getAdminToken();
}

function getSpeakerFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const match = Object.values(SPEAKER_CREDENTIALS).find(sp =>
    getSpeakerToken(sp.name) === token
  );
  return match ? match.name : null;
}

// Submit rehearsal feedback
app.post('/api/rehearsal/submit', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.speakerName) return res.status(400).json({ error: 'נתונים לא תקינים' });
    const sessionId = data.sessionId || 'anon';
    let records = readAll().filter(r => !(r.sessionId === sessionId && r.speakerName === data.speakerName));
    const record = { id: Date.now(), submitted_at: new Date().toLocaleString('he-IL'), ...data };
    fs.writeFileSync(DB, [...records, record].map(r => JSON.stringify(r)).join('\n') + '\n');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL    || 'info.aidesign1@gmail.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'lukathedog2026';
  if (email === adminEmail && password === adminPass) {
    res.json({ ok: true, token: getAdminToken() });
  } else {
    res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }
});

// Bulk import (admin only — one-time restore)
app.post('/api/admin/import', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'אין הרשאה' });
  const records = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'expected array' });
  fs.writeFileSync(DB, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  res.json({ ok: true, count: records.length });
});

// Speaker login — email + name as password
app.post('/api/speaker/login', (req, res) => {
  const { email, password } = req.body || {};
  const emailLower = (email || '').toLowerCase().trim();
  const cred = SPEAKER_CREDENTIALS[emailLower];
  if (!cred || cred.password !== (password || '').trim()) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }
  res.json({ ok: true, token: getSpeakerToken(cred.name), speakerName: cred.name });
});

// Get all rehearsal responses (admin)
app.get('/api/rehearsal/responses', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'אין הרשאה' });
  res.json(readAll());
});

// Get my responses (speaker)
app.get('/api/rehearsal/my-responses', (req, res) => {
  const speaker = getSpeakerFromToken(req);
  if (!speaker) return res.status(401).json({ error: 'אין הרשאה' });
  res.json(readAll().filter(r => r.speakerName === speaker));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  Design AI Rehearsal — http://localhost:${PORT}`);
  console.log(`🎬  שאלון חזרה:   http://localhost:${PORT}/rehearsal.html`);
  console.log(`⚙️   פאנל ניהול:  http://localhost:${PORT}/rehearsal-admin.html`);
  console.log(`🎤  פאנל מרצה:   http://localhost:${PORT}/speaker.html`);
});
