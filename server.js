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
  const pass = process.env.SPEAKER_PASSWORD || 'designai7';
  return crypto.createHmac('sha256', pass).update(speakerName).digest('hex');
}

function isAdmin(req) {
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer ') && auth.slice(7) === getAdminToken();
}

function getSpeakerFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const pass = process.env.SPEAKER_PASSWORD || 'designai7';
  // find which speaker this token matches
  const SPEAKERS = [
    'דניאל בוארון','עומרי הרמן','גל דולב','חן האנה ויצמן','ד"ר יעקב גרינשפן',
    'רון ברנוב','שחר קגן','עידו זייפמן וקרן שגב','ענבל ברקוביץ','טל זגורי',
    'שירה וינברג הראל','שלי אור גיסר'
  ];
  return SPEAKERS.find(name =>
    crypto.createHmac('sha256', pass).update(name).digest('hex') === token
  ) || null;
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

// Speaker login
app.post('/api/speaker/login', (req, res) => {
  const { speakerName, password } = req.body || {};
  const speakerPass = process.env.SPEAKER_PASSWORD || 'designai7';
  if (!speakerName) return res.status(400).json({ error: 'שם מרצה חסר' });
  if (password !== speakerPass) return res.status(401).json({ error: 'קוד גישה שגוי' });
  res.json({ ok: true, token: getSpeakerToken(speakerName), speakerName });
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
