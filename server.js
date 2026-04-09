const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(process.env.DB_PATH || './data/checklist.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operador',
    sector TEXT DEFAULT NULL,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
    color TEXT NOT NULL, bg TEXT NOT NULL, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id TEXT NOT NULL, tab TEXT NOT NULL, text TEXT NOT NULL,
    note TEXT DEFAULT NULL, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    FOREIGN KEY (sector_id) REFERENCES sectors(id)
  );
  CREATE TABLE IF NOT EXISTS checklist_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL, date TEXT NOT NULL, tab TEXT NOT NULL,
    done INTEGER DEFAULT 0, done_by TEXT DEFAULT NULL,
    done_by_id INTEGER DEFAULT NULL, done_at TEXT DEFAULT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    UNIQUE(task_id, date, tab)
  );
  CREATE TABLE IF NOT EXISTS finalizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id TEXT NOT NULL, date TEXT NOT NULL, tab TEXT NOT NULL,
    finalized_by TEXT NOT NULL, finalized_at TEXT NOT NULL,
    UNIQUE(sector_id, date, tab)
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, user_name TEXT NOT NULL,
    date TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT DEFAULT NULL,
    UNIQUE(user_id, date)
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, sector_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    UNIQUE(user_id, sector_id, day_of_week)
  );
`);
try { db.exec('ALTER TABLE checklist_entries ADD COLUMN done_by_id INTEGER DEFAULT NULL'); } catch(e) {}

function seed() {
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0) {
    const ins = db.prepare('INSERT INTO users (username, password, name, role, sector) VALUES (?,?,?,?,?)');
    [['nayara','nay123','Nayara','admin',null],['simone','sim123','Simone','gerente',null],['neia','neia123','Neia','gerente',null],['thiago','thi123','Thiago','operador','salao'],['leonardo','leo123','Leonardo','operador','salao'],['deivison','dei123','Deivison','operador','cozinha'],['paulo','pau123','Paulo','operador','cozinha'],['jorge','jor123','Jorge','operador','cozinha']].forEach(u => ins.run(...u));
  }
  if (db.prepare('SELECT COUNT(*) as c FROM sectors').get().c === 0) {
    const ins = db.prepare('INSERT INTO sectors (id,name,icon,color,bg,sort_order) VALUES (?,?,?,?,?,?)');
    [['salao','Salão','🪑','#4A7C59','#EAF3EC',1],['cozinha','Cozinha','🍳','#C8553D','#F9ECEA',2],['copa','Copa','🥤','#2B7A9E','#E8F4F8',3],['banheiro','Banheiro','🚿','#8B5CF6','#F0EBFF',4],['gourmet','Área Gourmet','🍽️','#C49A2A','#FDF6E3',5]].forEach(s => ins.run(...s));
  }
  if (db.prepare('SELECT COUNT(*) as c FROM tasks').get().c === 0) {
    const ins = db.prepare('INSERT INTO tasks (sector_id,tab,text,note,sort_order) VALUES (?,?,?,?,?)');
    const T = {abertura:{salao:[['Ligar disjuntor 1 e 2 para iluminação'],['Abrir portas de vidro, portas de ferro e retirar a barra de ferro'],['Colocar tapete e bandeira para fora'],['Verificar se precisa lavar a calçada e molhar as plantas'],['Limpeza do salão — varrer e passar pano'],['Higienizar mesas e cadeiras'],['Organizar e repor guardanapos, sal, açúcar e palito'],['Ligar TV no volume 30, opção pendrive'],['Verificar se as máquinas de cartão estão carregadas'],['Ligar computador do caixa'],['Verificar valor na balança e no sistema']],cozinha:[['Ligar gás'],['Ligar disjuntores: forno, exaustor e fritadeira'],['Colocar lixo para fora','Seg, Qua, Sex e Dom'],['Verificar temperatura dos freezers'],['Higienizar bancadas e mesas para produção'],['Organizar a praça e separar mise en place completa'],['Verificar forno e fritadeira para produção'],['Ligar exaustores quando começar a produzir']],copa:[['Verificar gelo e repor as cubas'],['Verificar e repor frutas'],['Separar as frutas do dia para sucos'],['Higienizar pratos e talheres'],['Higienizar e organizar a copa'],['Verificar tara da balança'],['Verificar preço do sistema']],banheiro:[['Higienizar vaso e mictório'],['Verificar e repor papel higiênico'],['Verificar e repor papel toalha'],['Verificar e repor sabonete'],['Higienizar pia de mármore'],['Verificar e esvaziar lixeiras']],gourmet:[['Ligar disjuntores 1, 2 e 3 de cima e o do meio de baixo','Meio = buffet · Cima = luz / rechaud / saladeira'],['Limpar todos os rechauds com esponja e sabão'],['Limpar buffet frio e quente'],['Higienizar saladeiras'],['Verificar e repor molhos'],['Verificar nível de água em todos os rechauds e buffet']]},fechamento:{salao:[['Limpar e higienizar todas as mesas e cadeiras'],['Varrer e passar pano no salão'],['Recolher guardanapos, sal, açúcar e palito das mesas'],['Desligar TV'],['Conferir máquinas de cartão no carregador'],['Fechar caixa no sistema e desligar computador'],['Recolher tapete e bandeira'],['Fechar portas de vidro, portas de ferro e colocar barra de ferro'],['Desligar disjuntor 1 e 2 da iluminação'],['Verificar se não ficaram pertences de clientes']],cozinha:[['Desligar forno, fritadeira e exaustores'],['Desligar gás'],['Limpar e higienizar bancadas, mesas e equipamentos'],['Armazenar sobras corretamente — etiquetar com data'],['Verificar se freezers estão fechados e na temperatura correta'],['Retirar lixo da cozinha'],['Lavar piso da cozinha'],['Desligar disjuntores: forno, exaustor e fritadeira']],copa:[['Guardar frutas na geladeira'],['Higienizar e guardar todos os pratos e talheres'],['Limpar e secar bancadas da copa'],['Descartar gelo restante e limpar cubas'],['Limpar e organizar a copa para o dia seguinte'],['Retirar lixo da copa']],banheiro:[['Higienizar vaso e mictório'],['Limpar pia de mármore e espelhos'],['Verificar e repor papel higiênico para o dia seguinte'],['Verificar e repor papel toalha'],['Verificar e repor sabonete'],['Esvaziar e limpar lixeiras'],['Passar pano no piso do banheiro']],gourmet:[['Desligar todos os rechauds e buffet'],['Limpar e secar todos os rechauds'],['Limpar buffet frio e quente'],['Higienizar e guardar saladeiras'],['Guardar molhos na geladeira'],['Esvaziar e limpar água dos rechauds'],['Desligar disjuntores 1, 2 e 3 de cima e o do meio de baixo']]}};
    db.transaction(() => { for (const [tab, secs] of Object.entries(T)) for (const [sec, items] of Object.entries(secs)) items.forEach((it, i) => ins.run(sec, tab, it[0], it[1]||null, i)); })();
  }
}
seed();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function today() { return new Date().toISOString().slice(0,10); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}); }

// AUTH + auto check-in
app.post('/api/login', (req, res) => {
  const {username,password} = req.body;
  const user = db.prepare('SELECT id,username,name,role,sector FROM users WHERE username=? AND password=? AND active=1').get(username?.toLowerCase(), password);
  if (!user) return res.status(401).json({error:'Credenciais inválidas'});
  try { db.prepare('INSERT OR IGNORE INTO attendance (user_id,user_name,date,check_in) VALUES (?,?,?,?)').run(user.id, user.name, today(), nowTime()); } catch(e){}
  res.json(user);
});

app.get('/api/sectors', (req, res) => { res.json(db.prepare('SELECT * FROM sectors ORDER BY sort_order').all()); });

app.get('/api/checklist/:tab', (req, res) => {
  const {tab} = req.params, date = today(), dow = new Date().getDay();
  const sectors = db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();
  res.json(sectors.map(s => {
    const tasks = db.prepare('SELECT * FROM tasks WHERE sector_id=? AND tab=? AND active=1 ORDER BY sort_order').all(s.id, tab);
    const items = tasks.map(t => { const e = db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(t.id, date, tab); return {id:t.id,text:t.text,note:t.note,done:e?!!e.done:false,done_by:e?.done_by||null,done_at:e?.done_at||null}; });
    const fin = db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id, date, tab);
    const assigned = db.prepare('SELECT u.name FROM shifts sh JOIN users u ON sh.user_id=u.id WHERE sh.sector_id=? AND sh.day_of_week=? AND u.active=1').all(s.id, dow);
    return {...s, items, finalized:!!fin, finalizedBy:fin?.finalized_by||null, finalizedAt:fin?.finalized_at||null, assignedToday:assigned.map(a=>a.name)};
  }));
});

app.post('/api/toggle', (req, res) => {
  const {task_id,tab,user_name,user_id} = req.body, date = today();
  let e = db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(task_id, date, tab);
  if (e) { if(e.done) db.prepare('UPDATE checklist_entries SET done=0,done_by=NULL,done_by_id=NULL,done_at=NULL WHERE id=?').run(e.id); else db.prepare('UPDATE checklist_entries SET done=1,done_by=?,done_by_id=?,done_at=? WHERE id=?').run(user_name,user_id||null,nowTime(),e.id); }
  else db.prepare('INSERT INTO checklist_entries (task_id,date,tab,done,done_by,done_by_id,done_at) VALUES (?,?,?,1,?,?,?)').run(task_id,date,tab,user_name,user_id||null,nowTime());
  res.json({ok:true});
});

app.post('/api/finalize', (req, res) => {
  const {sector_id,tab,finalized_by} = req.body;
  try { db.prepare('INSERT OR REPLACE INTO finalizations (sector_id,date,tab,finalized_by,finalized_at) VALUES (?,?,?,?,?)').run(sector_id,today(),tab,finalized_by,nowTime()); res.json({ok:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});

// ATTENDANCE
app.get('/api/attendance', (req, res) => {
  const days = parseInt(req.query.days)||7, dates = [];
  for (let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}
  res.json(db.prepare(`SELECT * FROM attendance WHERE date IN (${dates.map(()=>'?').join(',')}) ORDER BY date DESC, check_in`).all(...dates));
});
app.get('/api/attendance/today', (req, res) => { res.json(db.prepare('SELECT * FROM attendance WHERE date=? ORDER BY check_in').all(today())); });
app.post('/api/attendance/checkout', (req, res) => { db.prepare('UPDATE attendance SET check_out=? WHERE user_id=? AND date=?').run(nowTime(),req.body.user_id,today()); res.json({ok:true}); });

// SHIFTS
app.get('/api/shifts', (req, res) => {
  res.json(db.prepare('SELECT s.id,s.user_id,s.sector_id,s.day_of_week,u.name as user_name,sec.name as sector_name,sec.icon as sector_icon FROM shifts s JOIN users u ON s.user_id=u.id JOIN sectors sec ON s.sector_id=sec.id WHERE u.active=1 ORDER BY s.day_of_week,u.name').all());
});
app.post('/api/shifts/bulk', (req, res) => {
  const {user_id,assignments} = req.body;
  db.transaction(()=>{db.prepare('DELETE FROM shifts WHERE user_id=?').run(user_id);const ins=db.prepare('INSERT INTO shifts (user_id,sector_id,day_of_week) VALUES (?,?,?)');(assignments||[]).forEach(a=>ins.run(user_id,a.sector_id,a.day_of_week));})();
  res.json({ok:true});
});
app.delete('/api/shifts/:id', (req, res) => { db.prepare('DELETE FROM shifts WHERE id=?').run(req.params.id); res.json({ok:true}); });

// RANKING
app.get('/api/ranking', (req, res) => {
  const days = parseInt(req.query.days)||7, dates = [];
  for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}
  const ph = dates.map(()=>'?').join(',');
  res.json({
    taskRanking: db.prepare(`SELECT done_by as name, COUNT(*) as tasks_done FROM checklist_entries WHERE done=1 AND date IN (${ph}) AND done_by IS NOT NULL GROUP BY done_by ORDER BY tasks_done DESC`).all(...dates),
    attendanceRanking: db.prepare(`SELECT user_name as name, COUNT(*) as days_present FROM attendance WHERE date IN (${ph}) GROUP BY user_name ORDER BY days_present DESC`).all(...dates),
    finalizationRanking: db.prepare(`SELECT finalized_by as name, COUNT(*) as sectors_finalized FROM finalizations WHERE date IN (${ph}) GROUP BY finalized_by ORDER BY sectors_finalized DESC`).all(...dates),
    earlyBird: db.prepare(`SELECT user_name as name, MIN(check_in) as earliest FROM attendance WHERE date IN (${ph}) GROUP BY user_name ORDER BY earliest ASC`).all(...dates),
    period: days
  });
});

// REPORTS
app.get('/api/reports', (req, res) => {
  const days = parseInt(req.query.days)||7, dates = [];
  for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}
  const sectors = db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();
  res.json(dates.map(date => {
    const tabs = ['abertura','fechamento'].map(tab => ({tab, sectors: sectors.map(s => {
      const total = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE sector_id=? AND tab=? AND active=1').get(s.id,tab).c;
      const done = db.prepare('SELECT COUNT(*) as c FROM checklist_entries WHERE task_id IN (SELECT id FROM tasks WHERE sector_id=? AND tab=? AND active=1) AND date=? AND tab=? AND done=1').get(s.id,tab,date,tab).c;
      const fin = db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);
      return {id:s.id,name:s.name,icon:s.icon,total,done,finalized:!!fin,finalizedBy:fin?.finalized_by||null,finalizedAt:fin?.finalized_at||null};
    })}));
    const attendance = db.prepare('SELECT user_name,check_in,check_out FROM attendance WHERE date=? ORDER BY check_in').all(date);
    return {date,tabs,attendance};
  }));
});

app.get('/api/reports/:date/:tab', (req, res) => {
  const {date,tab} = req.params;
  const sectors = db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();
  res.json(sectors.map(s => {
    const tasks = db.prepare('SELECT * FROM tasks WHERE sector_id=? AND tab=? AND active=1 ORDER BY sort_order').all(s.id,tab);
    const items = tasks.map(t=>{const e=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(t.id,date,tab);return{text:t.text,done:e?!!e.done:false,done_by:e?.done_by||null,done_at:e?.done_at||null};});
    const fin = db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);
    return {...s,items,finalized:!!fin,finalizedBy:fin?.finalized_by||null,finalizedAt:fin?.finalized_at||null};
  }));
});

// ADMIN
app.get('/api/users', (req,res) => { res.json(db.prepare('SELECT id,username,name,role,sector,active FROM users ORDER BY name').all()); });
app.post('/api/users', (req,res) => { const{username,password,name,role,sector}=req.body; try{db.prepare('INSERT INTO users (username,password,name,role,sector) VALUES (?,?,?,?,?)').run(username.toLowerCase(),password,name,role||'operador',sector||null);res.json({ok:true});}catch(e){res.status(400).json({error:'Usuário já existe'});} });
app.put('/api/users/:id', (req,res) => { const{name,role,sector,password,active}=req.body;const s=[],v=[];if(name!==undefined){s.push('name=?');v.push(name);}if(role!==undefined){s.push('role=?');v.push(role);}if(sector!==undefined){s.push('sector=?');v.push(sector);}if(password!==undefined){s.push('password=?');v.push(password);}if(active!==undefined){s.push('active=?');v.push(active);}if(!s.length)return res.status(400).json({error:'Nada'});v.push(req.params.id);db.prepare(`UPDATE users SET ${s.join(',')} WHERE id=?`).run(...v);res.json({ok:true}); });
app.delete('/api/users/:id', (req,res) => { db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ok:true}); });

app.get('/api/tasks', (req,res) => { res.json(db.prepare('SELECT * FROM tasks WHERE active=1 ORDER BY tab,sector_id,sort_order').all()); });
app.post('/api/tasks', (req,res) => { const{sector_id,tab,text,note}=req.body;const m=db.prepare('SELECT MAX(sort_order) as m FROM tasks WHERE sector_id=? AND tab=?').get(sector_id,tab).m||0;db.prepare('INSERT INTO tasks (sector_id,tab,text,note,sort_order) VALUES (?,?,?,?,?)').run(sector_id,tab,text,note||null,m+1);res.json({ok:true}); });
app.put('/api/tasks/:id', (req,res) => { const{text,note}=req.body;db.prepare('UPDATE tasks SET text=?,note=? WHERE id=?').run(text,note||null,req.params.id);res.json({ok:true}); });
app.delete('/api/tasks/:id', (req,res) => { db.prepare('UPDATE tasks SET active=0 WHERE id=?').run(req.params.id);res.json({ok:true}); });

app.post('/api/reset-day', (req,res) => { const d=today();db.prepare('DELETE FROM checklist_entries WHERE date=?').run(d);db.prepare('DELETE FROM finalizations WHERE date=?').run(d);res.json({ok:true}); });

app.get('*', (req,res) => { res.sendFile(path.join(__dirname,'public','index.html')); });

const dataDir = path.dirname(process.env.DB_PATH || './data/checklist.db');
require('fs').mkdirSync(dataDir, {recursive:true});
app.listen(PORT, () => console.log(`Toca do Coelho rodando na porta ${PORT}`));
