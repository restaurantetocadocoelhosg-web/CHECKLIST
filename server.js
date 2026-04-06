// ─── CHECKLIST TOCA DO COELHO ─────────────────────────────────────────────────
// server.js — Node.js + Express + SQLite (sem PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express')
const session  = require('express-session')
const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const app  = express()
const PORT = process.env.PORT || 3000

// ─── BANCO DE DADOS ───────────────────────────────────────────────────────────
const DB_DIR  = path.join(__dirname, 'data')
const DB_PATH = path.join(DB_DIR, 'checklist.db')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── CRIAR TABELAS ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'operador',
    color      TEXT DEFAULT '#6b1414',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS progress (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT NOT NULL,
    sector_id       TEXT NOT NULL,
    type            TEXT NOT NULL,
    completed_tasks TEXT DEFAULT '[]',
    task_times      TEXT DEFAULT '{}',
    task_users      TEXT DEFAULT '{}',
    completed       INTEGER DEFAULT 0,
    completed_by    TEXT,
    completed_at    TEXT,
    approved        INTEGER DEFAULT 0,
    approved_by     TEXT,
    approved_at     TEXT,
    UNIQUE(date, sector_id, type)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    sector_id   TEXT NOT NULL,
    type        TEXT NOT NULL,
    user_id     TEXT,
    user_name   TEXT,
    action      TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`)

// Criar usuário admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (id, username, password, name, role, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin-001', 'admin', '1234', 'Administrador', 'admin', '#6b1414')

  // Criar usuários padrão da equipe
  const equipe = [
    { id:'u-nayara',  username:'nayara',  name:'Nayara',  role:'admin',    color:'#b45309' },
    { id:'u-simone',  username:'simone',  name:'Simone',  role:'gerente',  color:'#7c3aed' },
    { id:'u-daniel',  username:'daniel',  name:'Daniel',  role:'operador', color:'#1d4ed8' },
    { id:'u-julia',   username:'julia',   name:'Julia',   role:'operador', color:'#0369a1' },
    { id:'u-larissa', username:'larissa', name:'Larissa', role:'operador', color:'#be185d' },
    { id:'u-leonardo',username:'leonardo',name:'Leonardo',role:'operador', color:'#0f766e' },
  ]
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, name, role, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const u of equipe) {
    insertUser.run(u.id, u.username, '1234', u.name, u.role, u.color)
  }
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
  secret: process.env.SESSION_SECRET || 'toca-do-coelho-checklist-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}))

// ─── HELPER ───────────────────────────────────────────────────────────────────
function parseJSON(val, fallback) {
  try { return JSON.parse(val) } catch { return fallback }
}

function formatProgress(row) {
  if (!row) return null
  return {
    ...row,
    completed_tasks: parseJSON(row.completed_tasks, []),
    task_times:      parseJSON(row.task_times, {}),
    task_users:      parseJSON(row.task_users, {}),
    completed:       !!row.completed,
    approved:        !!row.approved,
  }
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' })
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })
  req.user = user
  next()
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'gerente')
    return res.status(403).json({ error: 'Sem permissão' })
  next()
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' })

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim())
  if (!user || user.password !== password)
    return res.status(401).json({ error: 'Usuário ou senha incorretos' })

  req.session.userId = user.id
  const { password: _, ...safeUser } = user
  res.json({ user: safeUser })
})

app.get('/api/me', requireAuth, (req, res) => {
  const { password: _, ...safeUser } = req.user
  res.json({ user: safeUser })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy()
  res.json({ ok: true })
})

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, color FROM users ORDER BY name').all()
  res.json(users)
})

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { id, username, password, name, role, color } = req.body
  if (!username || !password || !name) return res.status(400).json({ error: 'Dados incompletos' })

  try {
    db.prepare(`
      INSERT INTO users (id, username, password, name, role, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id || ('u' + Date.now()), username.toLowerCase().trim(), password, name, role || 'operador', color || '#6b1414')
    res.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Login já existe' })
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Não pode remover a si mesmo' })
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── PROGRESSO ────────────────────────────────────────────────────────────────
app.get('/api/progress', requireAuth, (req, res) => {
  const { date } = req.query
  const rows = date
    ? db.prepare('SELECT * FROM progress WHERE date = ?').all(date)
    : db.prepare('SELECT * FROM progress').all()
  res.json(rows.map(formatProgress))
})

app.put('/api/progress/:sectorId/:type', requireAuth, (req, res) => {
  const { sectorId, type } = req.params
  const {
    date, completed_tasks, task_times, task_users,
    completed, completed_by, completed_at,
    approved, approved_by, approved_at
  } = req.body

  const d = date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

  const existing = db.prepare(
    'SELECT id FROM progress WHERE date = ? AND sector_id = ? AND type = ?'
  ).get(d, sectorId, type)

  if (existing) {
    db.prepare(`
      UPDATE progress SET
        completed_tasks = ?, task_times = ?, task_users = ?,
        completed = ?, completed_by = ?, completed_at = ?,
        approved = ?, approved_by = ?, approved_at = ?
      WHERE date = ? AND sector_id = ? AND type = ?
    `).run(
      JSON.stringify(completed_tasks || []),
      JSON.stringify(task_times || {}),
      JSON.stringify(task_users || {}),
      completed ? 1 : 0, completed_by || null, completed_at || null,
      approved ? 1 : 0, approved_by || null, approved_at || null,
      d, sectorId, type
    )
  } else {
    db.prepare(`
      INSERT INTO progress
        (date, sector_id, type, completed_tasks, task_times, task_users,
         completed, completed_by, completed_at, approved, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      d, sectorId, type,
      JSON.stringify(completed_tasks || []),
      JSON.stringify(task_times || {}),
      JSON.stringify(task_users || {}),
      completed ? 1 : 0, completed_by || null, completed_at || null,
      approved ? 1 : 0, approved_by || null, approved_at || null
    )
  }

  // Registrar log se foi finalizado
  if (completed) {
    db.prepare(`
      INSERT INTO logs (date, sector_id, type, user_id, user_name, action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(d, sectorId, type, req.user.id, req.user.name, 'finalizado')
  }

  const row = db.prepare(
    'SELECT * FROM progress WHERE date = ? AND sector_id = ? AND type = ?'
  ).get(d, sectorId, type)
  res.json(formatProgress(row))
})

app.delete('/api/progress/today', requireAuth, requireAdmin, (req, res) => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  db.prepare('DELETE FROM progress WHERE date = ?').run(today)
  res.json({ ok: true })
})

// ─── LOGS / HISTÓRICO ─────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, (req, res) => {
  const logs = db.prepare(
    'SELECT * FROM logs ORDER BY created_at DESC LIMIT 200'
  ).all()
  res.json(logs)
})

// ─── FRONTEND ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Checklist Toca do Coelho rodando na porta ${PORT}`)
  console.log(`📦 Banco de dados: ${DB_PATH}`)
})
