const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(process.env.DB_PATH || './data/checklist.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'operador',sector TEXT DEFAULT NULL,active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS sectors (id TEXT PRIMARY KEY,name TEXT NOT NULL,icon TEXT NOT NULL,color TEXT NOT NULL,bg TEXT NOT NULL,sort_order INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT,sector_id TEXT NOT NULL,tab TEXT NOT NULL,text TEXT NOT NULL,note TEXT DEFAULT NULL,sort_order INTEGER DEFAULT 0,active INTEGER DEFAULT 1,critical INTEGER DEFAULT 0,FOREIGN KEY(sector_id) REFERENCES sectors(id));
  CREATE TABLE IF NOT EXISTS checklist_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,task_id INTEGER NOT NULL,date TEXT NOT NULL,tab TEXT NOT NULL,done INTEGER DEFAULT 0,done_by TEXT DEFAULT NULL,done_by_id INTEGER DEFAULT NULL,done_at TEXT DEFAULT NULL,observation TEXT DEFAULT NULL,FOREIGN KEY(task_id) REFERENCES tasks(id),UNIQUE(task_id,date,tab));
  CREATE TABLE IF NOT EXISTS finalizations (id INTEGER PRIMARY KEY AUTOINCREMENT,sector_id TEXT NOT NULL,date TEXT NOT NULL,tab TEXT NOT NULL,finalized_by TEXT NOT NULL,finalized_at TEXT NOT NULL,signature TEXT DEFAULT NULL,UNIQUE(sector_id,date,tab));
  CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,user_name TEXT NOT NULL,date TEXT NOT NULL,check_in TEXT NOT NULL,check_out TEXT DEFAULT NULL,UNIQUE(user_id,date));
  CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,user_name TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,action TEXT DEFAULT 'open');
  CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,sector_id TEXT NOT NULL,day_of_week INTEGER NOT NULL,UNIQUE(user_id,sector_id,day_of_week));
  CREATE TABLE IF NOT EXISTS temperature_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,equipment TEXT NOT NULL,temperature REAL NOT NULL,min_temp REAL DEFAULT -25,max_temp REAL DEFAULT -10,date TEXT NOT NULL,time TEXT NOT NULL,logged_by TEXT NOT NULL,alert INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS expiry_items (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT DEFAULT 'geral',expiry_date TEXT NOT NULL,quantity TEXT DEFAULT NULL,added_by TEXT NOT NULL,added_at TEXT NOT NULL,replaced INTEGER DEFAULT 0,replaced_by TEXT DEFAULT NULL,replaced_at TEXT DEFAULT NULL,new_expiry_date TEXT DEFAULT NULL);
  CREATE TABLE IF NOT EXISTS admin_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,message TEXT NOT NULL,user_name TEXT NOT NULL,user_id INTEGER,date TEXT NOT NULL,time TEXT NOT NULL,seen INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS occurrences (id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,category TEXT DEFAULT 'geral',priority TEXT DEFAULT 'normal',created_by TEXT NOT NULL,created_at TEXT NOT NULL,date TEXT NOT NULL,resolved INTEGER DEFAULT 0,resolved_by TEXT DEFAULT NULL,resolved_at TEXT DEFAULT NULL);
  CREATE TABLE IF NOT EXISTS bulletin (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,message TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,date TEXT NOT NULL,active INTEGER DEFAULT 1,priority TEXT DEFAULT 'normal');
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,detail TEXT NOT NULL,user_name TEXT NOT NULL,user_id INTEGER,date TEXT NOT NULL,time TEXT NOT NULL);
`);
// Migrations
try{db.exec('ALTER TABLE checklist_entries ADD COLUMN done_by_id INTEGER DEFAULT NULL');}catch(e){}
try{db.exec('ALTER TABLE checklist_entries ADD COLUMN observation TEXT DEFAULT NULL');}catch(e){}
try{db.exec('ALTER TABLE tasks ADD COLUMN critical INTEGER DEFAULT 0');}catch(e){}
try{db.exec('ALTER TABLE expiry_items ADD COLUMN replaced INTEGER DEFAULT 0');}catch(e){}
try{db.exec('ALTER TABLE expiry_items ADD COLUMN replaced_by TEXT DEFAULT NULL');}catch(e){}
try{db.exec('ALTER TABLE expiry_items ADD COLUMN replaced_at TEXT DEFAULT NULL');}catch(e){}
try{db.exec('ALTER TABLE expiry_items ADD COLUMN new_expiry_date TEXT DEFAULT NULL');}catch(e){}
try{db.exec('ALTER TABLE finalizations ADD COLUMN signature TEXT DEFAULT NULL');}catch(e){}
try{db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('ranking_visible','0')").run();}catch(e){}

function seed(){
  if(db.prepare('SELECT COUNT(*) as c FROM users').get().c===0){
    const ins=db.prepare('INSERT INTO users (username,password,name,role,sector) VALUES (?,?,?,?,?)');
    [['nayara','nay123','Nayara','admin',null],['simone','sim123','Simone','gerente',null],['neia','neia123','Neia','gerente',null],['thiago','thi123','Thiago','operador','salao'],['leonardo','leo123','Leonardo','operador','salao'],['deivison','dei123','Deivison','operador','cozinha'],['paulo','pau123','Paulo','operador','cozinha'],['jorge','jor123','Jorge','operador','cozinha']].forEach(u=>ins.run(...u));
  }
  if(db.prepare('SELECT COUNT(*) as c FROM sectors').get().c===0){
    const ins=db.prepare('INSERT INTO sectors (id,name,icon,color,bg,sort_order) VALUES (?,?,?,?,?,?)');
    [['salao','Salão','🪑','#4A7C59','#EAF3EC',1],['cozinha','Cozinha','🍳','#C8553D','#F9ECEA',2],['copa','Copa','🥤','#2B7A9E','#E8F4F8',3],['banheiro','Banheiro','🚿','#8B5CF6','#F0EBFF',4],['gourmet','Área Gourmet','🍽️','#C49A2A','#FDF6E3',5]].forEach(s=>ins.run(...s));
  }
  if(db.prepare('SELECT COUNT(*) as c FROM tasks').get().c===0){
    const ins=db.prepare('INSERT INTO tasks (sector_id,tab,text,note,sort_order,critical) VALUES (?,?,?,?,?,?)');
    const T={abertura:{salao:[['Ligar disjuntor 1 e 2 para iluminação',null,0],['Abrir portas de vidro, portas de ferro e retirar a barra de ferro',null,0],['Colocar tapete e bandeira para fora',null,0],['Verificar se precisa lavar a calçada e molhar as plantas',null,0],['Limpeza do salão — varrer e passar pano',null,0],['Higienizar mesas e cadeiras',null,1],['Organizar e repor guardanapos, sal, açúcar e palito',null,0],['Ligar TV no volume 30, opção pendrive',null,0],['Verificar se as máquinas de cartão estão carregadas',null,1],['Ligar computador do caixa',null,1],['Verificar valor na balança e no sistema',null,1]],cozinha:[['Ligar gás',null,1],['Ligar disjuntores: forno, exaustor e fritadeira',null,1],['Colocar lixo para fora','Seg, Qua, Sex e Dom',0],['Verificar temperatura dos freezers',null,1],['Higienizar bancadas e mesas para produção',null,1],['Organizar a praça e separar mise en place completa',null,1],['Verificar forno e fritadeira para produção',null,0],['Ligar exaustores quando começar a produzir',null,0]],copa:[['Verificar gelo e repor as cubas',null,0],['Verificar e repor frutas',null,0],['Separar as frutas do dia para sucos',null,0],['Higienizar pratos e talheres',null,1],['Higienizar e organizar a copa',null,1],['Verificar tara da balança',null,1],['Verificar preço do sistema',null,1]],banheiro:[['Higienizar vaso e mictório',null,1],['Verificar e repor papel higiênico',null,1],['Verificar e repor papel toalha',null,1],['Verificar e repor sabonete',null,1],['Higienizar pia de mármore',null,1],['Verificar e esvaziar lixeiras',null,0]],gourmet:[['Ligar disjuntores 1, 2 e 3 de cima e o do meio de baixo','Meio=buffet · Cima=luz/rechaud/saladeira',1],['Limpar todos os rechauds com esponja e sabão',null,1],['Limpar buffet frio e quente',null,1],['Higienizar saladeiras',null,1],['Verificar e repor molhos',null,0],['Verificar nível de água em todos os rechauds e buffet',null,1]]},fechamento:{salao:[['Limpar e higienizar todas as mesas e cadeiras',null,1],['Varrer e passar pano no salão',null,1],['Recolher guardanapos, sal, açúcar e palito das mesas',null,0],['Desligar TV',null,0],['Conferir máquinas de cartão no carregador',null,1],['Fechar caixa no sistema e desligar computador',null,1],['Recolher tapete e bandeira',null,0],['Fechar portas de vidro, portas de ferro e colocar barra de ferro',null,1],['Desligar disjuntor 1 e 2 da iluminação',null,1],['Verificar se não ficaram pertences de clientes',null,0]],cozinha:[['Desligar forno, fritadeira e exaustores',null,1],['Desligar gás',null,1],['Limpar e higienizar bancadas, mesas e equipamentos',null,1],['Armazenar sobras corretamente — etiquetar com data',null,1],['Verificar se freezers estão fechados e na temperatura correta',null,1],['Retirar lixo da cozinha',null,0],['Lavar piso da cozinha',null,0],['Desligar disjuntores: forno, exaustor e fritadeira',null,1]],copa:[['Guardar frutas na geladeira',null,1],['Higienizar e guardar todos os pratos e talheres',null,1],['Limpar e secar bancadas da copa',null,0],['Descartar gelo restante e limpar cubas',null,0],['Limpar e organizar a copa para o dia seguinte',null,0],['Retirar lixo da copa',null,0]],banheiro:[['Higienizar vaso e mictório',null,1],['Limpar pia de mármore e espelhos',null,1],['Verificar e repor papel higiênico para o dia seguinte',null,1],['Verificar e repor papel toalha',null,1],['Verificar e repor sabonete',null,1],['Esvaziar e limpar lixeiras',null,0],['Passar pano no piso do banheiro',null,0]],gourmet:[['Desligar todos os rechauds e buffet',null,1],['Limpar e secar todos os rechauds',null,1],['Limpar buffet frio e quente',null,1],['Higienizar e guardar saladeiras',null,1],['Guardar molhos na geladeira',null,1],['Esvaziar e limpar água dos rechauds',null,0],['Desligar disjuntores 1, 2 e 3 de cima e o do meio de baixo',null,1]]}};
    db.transaction(()=>{for(const[tab,secs] of Object.entries(T))for(const[sec,items] of Object.entries(secs))items.forEach((it,i)=>ins.run(sec,tab,it[0],it[1]||null,i,it[2]||0));})();
  }
}
seed();

app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname,'public')));

function today(){return new Date().toISOString().slice(0,10);}
function nowTime(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});}

// AUTH
app.post('/api/login',(req,res)=>{const{username,password}=req.body;const user=db.prepare('SELECT id,username,name,role,sector FROM users WHERE username=? AND password=? AND active=1').get(username?.toLowerCase(),password);if(!user)return res.status(401).json({error:'Credenciais inválidas'});try{db.prepare('INSERT OR IGNORE INTO attendance (user_id,user_name,date,check_in) VALUES (?,?,?,?)').run(user.id,user.name,today(),nowTime());}catch(e){}db.prepare('INSERT INTO activity_log (user_id,user_name,date,time,action) VALUES (?,?,?,?,?)').run(user.id,user.name,today(),nowTime(),'login');let alertCount=0;if(user.role==='admin'||user.role==='gerente')alertCount=db.prepare('SELECT COUNT(*) as c FROM admin_alerts WHERE seen=0').get().c;const bulletins=db.prepare('SELECT * FROM bulletin WHERE active=1 ORDER BY id DESC').all();res.json({...user,alertCount,bulletins});});

// ACTIVITY PING (every time app is opened/resumed)
app.post('/api/ping',(req,res)=>{const{user_id,user_name}=req.body;try{db.prepare('INSERT OR IGNORE INTO attendance (user_id,user_name,date,check_in) VALUES (?,?,?,?)').run(user_id,user_name,today(),nowTime());}catch(e){}db.prepare('INSERT INTO activity_log (user_id,user_name,date,time,action) VALUES (?,?,?,?,?)').run(user_id,user_name,today(),nowTime(),'ping');res.json({ok:true});});
app.get('/api/activity',(req,res)=>{const date=req.query.date||today();res.json(db.prepare('SELECT * FROM activity_log WHERE date=? ORDER BY time DESC').all(date));});
app.get('/api/activity/user/:id',(req,res)=>{const days=parseInt(req.query.days)||7,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}res.json(db.prepare(`SELECT * FROM activity_log WHERE user_id=? AND date IN (${dates.map(()=>'?').join(',')}) ORDER BY date DESC,time DESC`).all(req.params.id,...dates));});

app.get('/api/sectors',(req,res)=>{res.json(db.prepare('SELECT * FROM sectors ORDER BY sort_order').all());});

// CHECKLIST
app.get('/api/checklist/:tab',(req,res)=>{const{tab}=req.params,date=today(),dow=new Date().getDay();const sectors=db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();res.json(sectors.map(s=>{const tasks=db.prepare('SELECT * FROM tasks WHERE sector_id=? AND tab=? AND active=1 ORDER BY sort_order').all(s.id,tab);const items=tasks.map(t=>{const e=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(t.id,date,tab);return{id:t.id,text:t.text,note:t.note,critical:!!t.critical,done:e?!!e.done:false,done_by:e?.done_by||null,done_at:e?.done_at||null,observation:e?.observation||null};});const fin=db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);const assigned=db.prepare('SELECT u.name FROM shifts sh JOIN users u ON sh.user_id=u.id WHERE sh.sector_id=? AND sh.day_of_week=? AND u.active=1').all(s.id,dow);return{...s,items,finalized:!!fin,finalizedBy:fin?.finalized_by||null,finalizedAt:fin?.finalized_at||null,signature:fin?.signature||null,assignedToday:assigned.map(a=>a.name)};}));});

// TOGGLE WITH AUDIT
app.post('/api/toggle',(req,res)=>{const{task_id,tab,user_name,user_id}=req.body,date=today();const existing=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(task_id,date,tab);const taskInfo=db.prepare('SELECT text FROM tasks WHERE id=?').get(task_id);
  if(existing&&existing.done){
    db.prepare('UPDATE checklist_entries SET done=0,done_by=NULL,done_by_id=NULL,done_at=NULL WHERE id=?').run(existing.id);
    db.prepare('INSERT INTO audit_log (action,detail,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('uncheck',`Desmarcou: "${taskInfo?.text}" (marcado por ${existing.done_by} às ${existing.done_at})`,user_name,user_id,today(),nowTime());
    return res.json({ok:true});
  }
  const userRow=db.prepare('SELECT role FROM users WHERE id=?').get(user_id);
  if(userRow&&(userRow.role==='admin'||userRow.role==='gerente')){if(existing)db.prepare('UPDATE checklist_entries SET done=1,done_by=?,done_by_id=?,done_at=? WHERE id=?').run(user_name,user_id,nowTime(),existing.id);else db.prepare('INSERT INTO checklist_entries (task_id,date,tab,done,done_by,done_by_id,done_at) VALUES (?,?,?,1,?,?,?)').run(task_id,date,tab,user_name,user_id,nowTime());db.prepare('INSERT INTO audit_log (action,detail,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('check',`Marcou: "${taskInfo?.text}"`,user_name,user_id,today(),nowTime());return res.json({ok:true});}
  const fiveMinAgo=new Date(Date.now()-5*60*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});const recentCount=db.prepare('SELECT COUNT(*) as c FROM checklist_entries WHERE done_by_id=? AND date=? AND done=1 AND done_at>=?').get(user_id,date,fiveMinAgo).c;
  if(recentCount>=2){db.prepare('INSERT INTO admin_alerts (type,message,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('throttle',`${user_name} tentou marcar durante bloqueio`,user_name,user_id,today(),nowTime());return res.status(429).json({error:'Aguarde 5 minutos.',blocked:true});}
  if(existing)db.prepare('UPDATE checklist_entries SET done=1,done_by=?,done_by_id=?,done_at=? WHERE id=?').run(user_name,user_id,nowTime(),existing.id);else db.prepare('INSERT INTO checklist_entries (task_id,date,tab,done,done_by,done_by_id,done_at) VALUES (?,?,?,1,?,?,?)').run(task_id,date,tab,user_name,user_id,nowTime());
  db.prepare('INSERT INTO audit_log (action,detail,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('check',`Marcou: "${taskInfo?.text}"`,user_name,user_id,today(),nowTime());
  res.json({ok:true,remaining:1-recentCount});
});

// OBSERVATION
app.post('/api/observation',(req,res)=>{const{task_id,tab,observation}=req.body,date=today();const existing=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(task_id,date,tab);if(existing)db.prepare('UPDATE checklist_entries SET observation=? WHERE id=?').run(observation||null,existing.id);else db.prepare('INSERT INTO checklist_entries (task_id,date,tab,observation) VALUES (?,?,?,?)').run(task_id,date,tab,observation);res.json({ok:true});});

// FINALIZE
app.post('/api/finalize',(req,res)=>{const{sector_id,tab,finalized_by,signature}=req.body,date=today();const critPending=db.prepare('SELECT t.text FROM tasks t LEFT JOIN checklist_entries e ON t.id=e.task_id AND e.date=? AND e.tab=? WHERE t.sector_id=? AND t.tab=? AND t.active=1 AND t.critical=1 AND (e.done IS NULL OR e.done=0)').all(date,tab,sector_id,tab);if(critPending.length>0)return res.status(400).json({error:'Tarefas obrigatórias pendentes',pending:critPending.map(t=>t.text)});try{db.prepare('INSERT OR REPLACE INTO finalizations (sector_id,date,tab,finalized_by,finalized_at,signature) VALUES (?,?,?,?,?,?)').run(sector_id,date,tab,finalized_by,nowTime(),signature||null);db.prepare('INSERT INTO audit_log (action,detail,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('finalize',`Finalizou setor ${sector_id} (${tab})`,finalized_by,null,today(),nowTime());res.json({ok:true});}catch(e){res.status(400).json({error:e.message});}});

// BULLETIN (Mural)
app.get('/api/bulletin',(req,res)=>{res.json(db.prepare('SELECT * FROM bulletin WHERE active=1 ORDER BY id DESC').all());});
app.post('/api/bulletin',(req,res)=>{const{title,message,priority}=req.body;db.prepare('INSERT INTO bulletin (title,message,created_by,created_at,date,priority) VALUES (?,?,?,?,?,?)').run(title,message,req.body.created_by,nowTime(),today(),priority||'normal');res.json({ok:true});});
app.put('/api/bulletin/:id',(req,res)=>{const{title,message,priority}=req.body;db.prepare('UPDATE bulletin SET title=?,message=?,priority=? WHERE id=?').run(title,message,priority||'normal',req.params.id);res.json({ok:true});});
app.delete('/api/bulletin/:id',(req,res)=>{db.prepare('UPDATE bulletin SET active=0 WHERE id=?').run(req.params.id);res.json({ok:true});});

// AUDIT LOG
app.get('/api/audit',(req,res)=>{const days=parseInt(req.query.days)||3,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}res.json(db.prepare(`SELECT * FROM audit_log WHERE date IN (${dates.map(()=>'?').join(',')}) ORDER BY id DESC LIMIT 100`).all(...dates));});

// OCCURRENCES
app.get('/api/occurrences',(req,res)=>{const days=parseInt(req.query.days)||7,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}res.json(db.prepare(`SELECT * FROM occurrences WHERE date IN (${dates.map(()=>'?').join(',')}) ORDER BY id DESC`).all(...dates));});
app.post('/api/occurrences',(req,res)=>{const{text,category,priority}=req.body;db.prepare('INSERT INTO occurrences (text,category,priority,created_by,created_at,date) VALUES (?,?,?,?,?,?)').run(text,category||'geral',priority||'normal',req.body.created_by,nowTime(),today());res.json({ok:true});});
app.post('/api/occurrences/:id/resolve',(req,res)=>{db.prepare('UPDATE occurrences SET resolved=1,resolved_by=?,resolved_at=? WHERE id=?').run(req.body.resolved_by,nowTime(),req.params.id);res.json({ok:true});});
app.delete('/api/occurrences/:id',(req,res)=>{db.prepare('DELETE FROM occurrences WHERE id=?').run(req.params.id);res.json({ok:true});});

// DASHBOARD
app.get('/api/dashboard',(req,res)=>{
  const date=today(),d7=[];for(let i=0;i<7;i++)d7.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10));
  const sectors=db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();
  const todayStats={};
  ['abertura','fechamento'].forEach(tab=>{todayStats[tab]=sectors.map(sc=>{const total=db.prepare('SELECT COUNT(*) as c FROM tasks WHERE sector_id=? AND tab=? AND active=1').get(sc.id,tab).c;const done=db.prepare('SELECT COUNT(*) as c FROM checklist_entries WHERE task_id IN (SELECT id FROM tasks WHERE sector_id=? AND tab=? AND active=1) AND date=? AND tab=? AND done=1').get(sc.id,tab,date,tab).c;const fin=db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(sc.id,date,tab);return{id:sc.id,name:sc.name,icon:sc.icon,total,done,finalized:!!fin};});});
  const weeklyRates=d7.map(dt=>{let td=0,ta=0;['abertura','fechamento'].forEach(tab=>{sectors.forEach(s=>{ta+=db.prepare('SELECT COUNT(*) as c FROM tasks WHERE sector_id=? AND tab=? AND active=1').get(s.id,tab).c;td+=db.prepare('SELECT COUNT(*) as c FROM checklist_entries WHERE task_id IN (SELECT id FROM tasks WHERE sector_id=? AND tab=? AND active=1) AND date=? AND tab=? AND done=1').get(s.id,tab,dt,tab).c;});});return{date:dt,pct:ta?Math.round(td/ta*100):0};});
  const presentToday=db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date=?').get(date).c;
  const openOccurrences=db.prepare('SELECT COUNT(*) as c FROM occurrences WHERE resolved=0').get().c;
  const tempAlerts=db.prepare('SELECT COUNT(*) as c FROM temperature_logs WHERE date=? AND alert=1').get(date).c;
  let expiringCount=0;db.prepare('SELECT expiry_date FROM expiry_items WHERE replaced=0').all().forEach(it=>{if(Math.ceil((new Date(it.expiry_date)-new Date(date))/86400000)<=3)expiringCount++;});
  const bulletins=db.prepare('SELECT * FROM bulletin WHERE active=1 ORDER BY id DESC LIMIT 5').all();
  res.json({todayStats,weeklyRates,presentToday,openOccurrences,tempAlerts,expiringCount,bulletins});
});

// PDF EXPORT
app.get('/api/export/pdf',(req,res)=>{
  const date=req.query.date||today();const sectors=db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();
  const att=db.prepare('SELECT * FROM attendance WHERE date=? ORDER BY check_in').all(date);
  let html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório ${date}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#333}h1{font-size:20px;margin-bottom:4px;color:#C8553D}h2{font-size:14px;margin:16px 0 8px;color:#2C2520;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font-size:12px;margin:10px 0 6px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:11px}th{background:#f5f0eb;font-weight:600}.done{color:#4A7C59}.pending{color:#C8553D}.crit{font-weight:700;color:#DC2626}.obs{font-size:10px;color:#666;font-style:italic}.sig-img{max-width:200px;max-height:80px;margin-top:8px}@media print{body{padding:10px}}</style></head><body>`;
  html+=`<h1>🐰 Toca do Coelho</h1><p style="color:#888;margin-bottom:20px">Relatório — ${date.split('-').reverse().join('/')}</p>`;
  if(att.length){html+='<h2>👥 Presença</h2><table><tr><th>Nome</th><th>Entrada</th><th>Saída</th></tr>';att.forEach(a=>{html+=`<tr><td>${a.user_name}</td><td>${a.check_in}</td><td>${a.check_out||'-'}</td></tr>`;});html+='</table>';}
  // Activity
  const activity=db.prepare('SELECT user_name,time,action FROM activity_log WHERE date=? ORDER BY time').all(date);
  if(activity.length){html+='<h2>📱 Atividade no App</h2><table><tr><th>Nome</th><th>Hora</th><th>Ação</th></tr>';activity.forEach(a=>{html+=`<tr><td>${a.user_name}</td><td>${a.time}</td><td>${a.action==='login'?'Login':'Retornou ao app'}</td></tr>`;});html+='</table>';}
  ['abertura','fechamento'].forEach(tab=>{
    html+=`<h2>${tab==='abertura'?'☀️ Abertura':'🌙 Fechamento'}</h2>`;
    sectors.forEach(s=>{
      const tasks=db.prepare('SELECT * FROM tasks WHERE sector_id=? AND tab=? AND active=1 ORDER BY sort_order').all(s.id,tab);if(!tasks.length)return;
      const fin=db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);
      html+=`<h3>${s.icon} ${s.name}${fin?' ✓ '+fin.finalized_by+' às '+fin.finalized_at:''}</h3><table><tr><th>Tarefa</th><th>Status</th><th>Quem</th><th>Hora</th><th>Obs</th></tr>`;
      tasks.forEach(t=>{const e=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(t.id,date,tab);html+=`<tr><td class="${t.critical?'crit':''}">${t.critical?'⚠️ ':''}${t.text}</td><td class="${e?.done?'done':'pending'}">${e?.done?'✅':'⬜'}</td><td>${e?.done_by||'-'}</td><td>${e?.done_at||'-'}</td><td class="obs">${e?.observation||''}</td></tr>`;});
      html+='</table>';if(fin?.signature)html+=`<p>Assinatura: <img class="sig-img" src="${fin.signature}"></p>`;
    });
  });
  const occ=db.prepare('SELECT * FROM occurrences WHERE date=?').all(date);
  if(occ.length){html+='<h2>📋 Ocorrências</h2><table><tr><th>Descrição</th><th>Prioridade</th><th>Por</th><th>Status</th></tr>';occ.forEach(o=>{html+=`<tr><td>${o.text}</td><td>${o.priority}</td><td>${o.created_by} ${o.created_at}</td><td>${o.resolved?'✅ '+o.resolved_by:'⏳'}</td></tr>`;});html+='</table>';}
  const temps=db.prepare('SELECT * FROM temperature_logs WHERE date=? ORDER BY time').all(date);
  if(temps.length){html+='<h2>🌡️ Temperaturas</h2><table><tr><th>Equipamento</th><th>Temp</th><th>Faixa</th><th>Por</th><th>Hora</th></tr>';temps.forEach(t=>{html+=`<tr style="${t.alert?'background:#fee2e2':''}"><td>${t.equipment}</td><td>${t.temperature}°C</td><td>${t.min_temp}° a ${t.max_temp}°</td><td>${t.logged_by}</td><td>${t.time}</td></tr>`;});html+='</table>';}
  html+=`<p style="margin-top:30px;color:#888;font-size:10px;text-align:center">Gerado em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p></body></html>`;
  res.setHeader('Content-Type','text/html');res.send(html);
});

// ALERTS
app.get('/api/alerts',(req,res)=>{res.json(db.prepare('SELECT * FROM admin_alerts ORDER BY id DESC LIMIT 50').all());});
app.post('/api/alerts/seen',(req,res)=>{db.prepare('UPDATE admin_alerts SET seen=1 WHERE seen=0').run();res.json({ok:true});});
app.get('/api/alerts/count',(req,res)=>{res.json({count:db.prepare('SELECT COUNT(*) as c FROM admin_alerts WHERE seen=0').get().c});});

// SETTINGS
app.get('/api/settings',(req,res)=>{const rows=db.prepare('SELECT * FROM settings').all();const obj={};rows.forEach(r=>obj[r.key]=r.value);res.json(obj);});
app.post('/api/settings',(req,res)=>{db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(req.body.key,req.body.value);res.json({ok:true});});

// TEMPERATURE
app.get('/api/temperatures',(req,res)=>{res.json(db.prepare('SELECT * FROM temperature_logs WHERE date=? ORDER BY time DESC').all(req.query.date||today()));});
app.post('/api/temperatures',(req,res)=>{const{equipment,temperature,min_temp,max_temp}=req.body;const temp=parseFloat(temperature),mn=parseFloat(min_temp)||-25,mx=parseFloat(max_temp)||-10;const alert=(temp<mn||temp>mx)?1:0;db.prepare('INSERT INTO temperature_logs (equipment,temperature,min_temp,max_temp,date,time,logged_by,alert) VALUES (?,?,?,?,?,?,?,?)').run(equipment,temp,mn,mx,today(),nowTime(),req.body.logged_by,alert);if(alert)db.prepare('INSERT INTO admin_alerts (type,message,user_name,user_id,date,time) VALUES (?,?,?,?,?,?)').run('temperature',`🌡️ ${equipment}: ${temp}°C fora da faixa`,req.body.logged_by,null,today(),nowTime());res.json({ok:true,alert});});

// EXPIRY
app.get('/api/expiry',(req,res)=>{const items=db.prepare('SELECT * FROM expiry_items ORDER BY expiry_date ASC').all();const t=today();res.json(items.map(i=>{const dl=Math.ceil((new Date(i.expiry_date)-new Date(t))/86400000);let st='ok';if(i.replaced)st='replaced';else if(dl<0)st='vencido';else if(dl<=3)st='critico';else if(dl<=5)st='atencao';return{...i,daysLeft:dl,status:st};}));});
app.post('/api/expiry',(req,res)=>{const{name,category,expiry_date,quantity}=req.body;db.prepare('INSERT INTO expiry_items (name,category,expiry_date,quantity,added_by,added_at) VALUES (?,?,?,?,?,?)').run(name,category||'geral',expiry_date,quantity||null,req.body.added_by,nowTime());res.json({ok:true});});
app.put('/api/expiry/:id',(req,res)=>{const{name,category,expiry_date,quantity}=req.body;db.prepare('UPDATE expiry_items SET name=?,category=?,expiry_date=?,quantity=? WHERE id=?').run(name,category,expiry_date,quantity||null,req.params.id);res.json({ok:true});});
app.post('/api/expiry/:id/replace',(req,res)=>{db.prepare('UPDATE expiry_items SET replaced=1,replaced_by=?,replaced_at=?,new_expiry_date=? WHERE id=?').run(req.body.replaced_by,nowTime(),req.body.new_expiry_date||null,req.params.id);res.json({ok:true});});
app.post('/api/expiry/:id/unreplace',(req,res)=>{const it=db.prepare('SELECT * FROM expiry_items WHERE id=?').get(req.params.id);if(it?.new_expiry_date)db.prepare('UPDATE expiry_items SET replaced=0,replaced_by=NULL,replaced_at=NULL,expiry_date=?,new_expiry_date=NULL WHERE id=?').run(it.new_expiry_date,req.params.id);else db.prepare('UPDATE expiry_items SET replaced=0,replaced_by=NULL,replaced_at=NULL WHERE id=?').run(req.params.id);res.json({ok:true});});
app.delete('/api/expiry/:id',(req,res)=>{db.prepare('DELETE FROM expiry_items WHERE id=?').run(req.params.id);res.json({ok:true});});

// ATTENDANCE
app.get('/api/attendance',(req,res)=>{const days=parseInt(req.query.days)||7,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}res.json(db.prepare(`SELECT * FROM attendance WHERE date IN (${dates.map(()=>'?').join(',')}) ORDER BY date DESC,check_in`).all(...dates));});
app.get('/api/attendance/today',(req,res)=>{res.json(db.prepare('SELECT * FROM attendance WHERE date=? ORDER BY check_in').all(today()));});

// SHIFTS
app.get('/api/shifts',(req,res)=>{res.json(db.prepare('SELECT s.id,s.user_id,s.sector_id,s.day_of_week,u.name as user_name,sec.name as sector_name,sec.icon as sector_icon FROM shifts s JOIN users u ON s.user_id=u.id JOIN sectors sec ON s.sector_id=sec.id WHERE u.active=1 ORDER BY s.day_of_week,u.name').all());});
app.post('/api/shifts/bulk',(req,res)=>{const{user_id,assignments}=req.body;db.transaction(()=>{db.prepare('DELETE FROM shifts WHERE user_id=?').run(user_id);const ins=db.prepare('INSERT INTO shifts (user_id,sector_id,day_of_week) VALUES (?,?,?)');(assignments||[]).forEach(a=>ins.run(user_id,a.sector_id,a.day_of_week));})();res.json({ok:true});});

// RANKING
app.get('/api/ranking',(req,res)=>{const days=parseInt(req.query.days)||7,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}const ph=dates.map(()=>'?').join(',');const rv=db.prepare("SELECT value FROM settings WHERE key='ranking_visible'").get()?.value==='1';res.json({rankingVisible:rv,taskRanking:db.prepare(`SELECT done_by as name,COUNT(*) as tasks_done FROM checklist_entries WHERE done=1 AND date IN (${ph}) AND done_by IS NOT NULL GROUP BY done_by ORDER BY tasks_done DESC`).all(...dates),attendanceRanking:db.prepare(`SELECT user_name as name,COUNT(*) as days_present FROM attendance WHERE date IN (${ph}) GROUP BY user_name ORDER BY days_present DESC`).all(...dates),finalizationRanking:db.prepare(`SELECT finalized_by as name,COUNT(*) as sectors_finalized FROM finalizations WHERE date IN (${ph}) GROUP BY finalized_by ORDER BY sectors_finalized DESC`).all(...dates),earlyBird:db.prepare(`SELECT user_name as name,MIN(check_in) as earliest FROM attendance WHERE date IN (${ph}) GROUP BY user_name ORDER BY earliest ASC`).all(...dates),period:days});});

// REPORTS
app.get('/api/reports',(req,res)=>{const days=parseInt(req.query.days)||7,dates=[];for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}const sectors=db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();res.json(dates.map(date=>{const tabs=['abertura','fechamento'].map(tab=>({tab,sectors:sectors.map(s=>{const total=db.prepare('SELECT COUNT(*) as c FROM tasks WHERE sector_id=? AND tab=? AND active=1').get(s.id,tab).c;const done=db.prepare('SELECT COUNT(*) as c FROM checklist_entries WHERE task_id IN (SELECT id FROM tasks WHERE sector_id=? AND tab=? AND active=1) AND date=? AND tab=? AND done=1').get(s.id,tab,date,tab).c;const fin=db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);return{id:s.id,name:s.name,icon:s.icon,total,done,finalized:!!fin,finalizedBy:fin?.finalized_by||null,finalizedAt:fin?.finalized_at||null};})}));const attendance=db.prepare('SELECT user_name,check_in,check_out FROM attendance WHERE date=? ORDER BY check_in').all(date);return{date,tabs,attendance};}));});
app.get('/api/reports/:date/:tab',(req,res)=>{const{date,tab}=req.params;const sectors=db.prepare('SELECT * FROM sectors ORDER BY sort_order').all();res.json(sectors.map(s=>{const tasks=db.prepare('SELECT * FROM tasks WHERE sector_id=? AND tab=? AND active=1 ORDER BY sort_order').all(s.id,tab);const items=tasks.map(t=>{const e=db.prepare('SELECT * FROM checklist_entries WHERE task_id=? AND date=? AND tab=?').get(t.id,date,tab);return{text:t.text,critical:!!t.critical,done:e?!!e.done:false,done_by:e?.done_by||null,done_at:e?.done_at||null,observation:e?.observation||null};});const fin=db.prepare('SELECT * FROM finalizations WHERE sector_id=? AND date=? AND tab=?').get(s.id,date,tab);return{...s,items,finalized:!!fin,finalizedBy:fin?.finalized_by||null,finalizedAt:fin?.finalized_at||null};}));});

// ADMIN
app.get('/api/users',(req,res)=>{res.json(db.prepare('SELECT id,username,name,role,sector,active FROM users ORDER BY name').all());});
app.post('/api/users',(req,res)=>{const{username,password,name,role,sector}=req.body;try{db.prepare('INSERT INTO users (username,password,name,role,sector) VALUES (?,?,?,?,?)').run(username.toLowerCase(),password,name,role||'operador',sector||null);res.json({ok:true});}catch(e){res.status(400).json({error:'Usuário já existe'});}});
app.put('/api/users/:id',(req,res)=>{const{name,role,sector,password,active}=req.body;const s=[],v=[];if(name!==undefined){s.push('name=?');v.push(name);}if(role!==undefined){s.push('role=?');v.push(role);}if(sector!==undefined){s.push('sector=?');v.push(sector);}if(password!==undefined){s.push('password=?');v.push(password);}if(active!==undefined){s.push('active=?');v.push(active);}if(!s.length)return res.status(400).json({error:'Nada'});v.push(req.params.id);db.prepare(`UPDATE users SET ${s.join(',')} WHERE id=?`).run(...v);res.json({ok:true});});
app.delete('/api/users/:id',(req,res)=>{db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);res.json({ok:true});});
app.get('/api/tasks',(req,res)=>{res.json(db.prepare('SELECT * FROM tasks WHERE active=1 ORDER BY tab,sector_id,sort_order').all());});
app.post('/api/tasks',(req,res)=>{const{sector_id,tab,text,note,critical}=req.body;const m=db.prepare('SELECT MAX(sort_order) as m FROM tasks WHERE sector_id=? AND tab=?').get(sector_id,tab).m||0;db.prepare('INSERT INTO tasks (sector_id,tab,text,note,sort_order,critical) VALUES (?,?,?,?,?,?)').run(sector_id,tab,text,note||null,m+1,critical?1:0);res.json({ok:true});});
app.put('/api/tasks/:id',(req,res)=>{const{text,note,critical}=req.body;db.prepare('UPDATE tasks SET text=?,note=?,critical=? WHERE id=?').run(text,note||null,critical?1:0,req.params.id);res.json({ok:true});});
app.delete('/api/tasks/:id',(req,res)=>{db.prepare('UPDATE tasks SET active=0 WHERE id=?').run(req.params.id);res.json({ok:true});});
app.post('/api/reset-day',(req,res)=>{const d=today();db.prepare('DELETE FROM checklist_entries WHERE date=?').run(d);db.prepare('DELETE FROM finalizations WHERE date=?').run(d);db.prepare('DELETE FROM temperature_logs WHERE date=?').run(d);res.json({ok:true});});

app.get('*',(req,res)=>{res.sendFile(path.join(__dirname,'public','index.html'));});
const dataDir=path.dirname(process.env.DB_PATH||'./data/checklist.db');
require('fs').mkdirSync(dataDir,{recursive:true});
app.listen(PORT,()=>console.log(`Toca do Coelho rodando na porta ${PORT}`));
