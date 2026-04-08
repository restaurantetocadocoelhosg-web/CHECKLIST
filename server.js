const express = require('express');
const { Pool }  = require('pg');
const session   = require('express-session');
const path      = require('path');
const fs        = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

// ─── DATABASE ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id      TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name    TEXT NOT NULL,
      role    TEXT NOT NULL DEFAULT 'operador',
      color   TEXT DEFAULT '#6b1414'
    );

    CREATE TABLE IF NOT EXISTS progress (
      id              SERIAL PRIMARY KEY,
      date            TEXT NOT NULL,
      sector_id       TEXT NOT NULL,
      type            TEXT NOT NULL,
      completed_tasks JSONB DEFAULT '[]',
      task_times      JSONB DEFAULT '{}',
      task_users      JSONB DEFAULT '{}',
      completed       BOOLEAN DEFAULT false,
      completed_by    TEXT,
      completed_at    TEXT,
      approved        BOOLEAN DEFAULT false,
      approved_by     TEXT,
      approved_at     TEXT,
      UNIQUE(date, sector_id, type)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id           BIGINT PRIMARY KEY,
      sector_id    TEXT NOT NULL,
      type         TEXT NOT NULL,
      date         TEXT NOT NULL,
      user_name    TEXT NOT NULL,
      approved_by  TEXT,
      completed_at TEXT,
      approved_at  TEXT,
      task_count   INTEGER DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed default users if none exist
  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) === 0) {
    const users = [
      { id:'u1', username:'nayara',   password:'1234', name:'Nayara',          role:'admin',    color:'#6b1414' },
      { id:'u2', username:'simone',   password:'1234', name:'Simone',          role:'gerente',  color:'#1d4ed8' },
      { id:'u3', username:'felipe',   password:'1234', name:'Felipe Deivison', role:'operador', color:'#7c3aed' },
      { id:'u4', username:'gabriele', password:'1234', name:'Gabriele',        role:'operador', color:'#15803d' },
      { id:'u5', username:'thiago',   password:'1234', name:'Thiago',          role:'operador', color:'#b45309' },
      { id:'u6', username:'leonardo', password:'1234', name:'Leonardo',        role:'operador', color:'#0369a1' },
    ];
    for (const u of users) {
      await pool.query(
        'INSERT INTO users (id,username,password,name,role,color) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [u.id, u.username, u.password, u.name, u.role, u.color]
      );
    }
    console.log('Default users created.');
  }
  console.log('Database ready.');
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'toca-coelho-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: 'none',
    httpOnly: true
  }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  next();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username=$1 AND password=$2',
      [username, password]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    req.session.userId = rows[0].id;
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.session.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' });
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const { id, username, password, name, role, color } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO users (id,username,password,name,role,color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, username, password, name, role, color]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Usuário já existe' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [password, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM progress WHERE date=$1',
      [date || todayBR()]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/progress/:sectorId/:type', requireAuth, async (req, res) => {
  try {
    const { sectorId, type } = req.params;
    const { date, completed_tasks, task_times, task_users, completed, completed_by, completed_at, approved, approved_by, approved_at } = req.body;
    const d = date || todayBR();
    const { rows } = await pool.query(`
      INSERT INTO progress (date,sector_id,type,completed_tasks,task_times,task_users,completed,completed_by,completed_at,approved,approved_by,approved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (date,sector_id,type) DO UPDATE SET
        completed_tasks=$4, task_times=$5, task_users=$6,
        completed=$7, completed_by=$8, completed_at=$9,
        approved=$10, approved_by=$11, approved_at=$12
      RETURNING *`,
      [d, sectorId, type,
       JSON.stringify(completed_tasks || []),
       JSON.stringify(task_times || {}),
       JSON.stringify(task_users || {}),
       completed || false, completed_by || null, completed_at || null,
       approved || false, approved_by || null, approved_at || null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LOGS ─────────────────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logs', requireAuth, async (req, res) => {
  try {
    const { id, sector_id, type, date, user_name, approved_by, completed_at, approved_at, task_count } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO logs (id,sector_id,type,date,user_name,approved_by,completed_at,approved_at,task_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING *',
      [id, sector_id, type, date, user_name, approved_by || null, completed_at, approved_at || null, task_count]
    );
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── RESET ────────────────────────────────────────────────────────────────────
app.delete('/api/progress/today', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM progress WHERE date=$1', [todayBR()]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function todayBR() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 10);
}

// ─── SERVE HTML ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🐰 Toca do Coelho rodando na porta ${PORT}`));
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});
