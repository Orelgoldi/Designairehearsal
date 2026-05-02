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

function getToken() {
  const email = process.env.ADMIN_EMAIL    || 'info.aidesign1@gmail.com';
  const pass  = process.env.ADMIN_PASSWORD || 'lukathedog2026';
  return crypto.createHmac('sha256', pass).update(email).digest('hex');
}

function isAdmin(req) {
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer ') && auth.slice(7) === getToken();
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
    res.json({ ok: true, token: getToken() });
  } else {
    res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }
});

// Get all rehearsal responses (admin)
app.get('/api/rehearsal/responses', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'אין הרשאה' });
  res.json(readAll());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  Design AI Rehearsal — http://localhost:${PORT}`);
  console.log(`🎬  שאלון חזרה:   http://localhost:${PORT}/rehearsal.html`);
  console.log(`⚙️   פאנל ניהול:  http://localhost:${PORT}/rehearsal-admin.html`);
});
