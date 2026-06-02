const express = require('express');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Anti-fraude: nº MÁXIMO de tarefas que um OPERADOR pode marcar por minuto.
// (admin e gerente são ISENTOS). 1 = exige ~1 minuto entre cada check.
const MAX_CHECKS_POR_MINUTO = 1;

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY são obrigatórios!');
  process.exit(1);
}

const sb = createClient(SUPA_URL, SUPA_KEY);

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function today() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
function datesBack(n) { const d = []; for (let i = 0; i < n; i++) { const dt = new Date(); dt.setDate(dt.getDate() - i); d.push(dt.toISOString().slice(0, 10)); } return d; }

async function requireAdmin(req, res) {
  const user_id = req.body?.user_id || req.query?.user_id;
  if (!user_id) { res.status(401).json({ error: 'Não autorizado' }); return null; }
  const { data: u } = await sb.from('ck_users').select('role').eq('id', user_id).eq('active', 1).single();
  if (!u || u.role !== 'admin') { res.status(403).json({ error: 'Acesso restrito ao admin' }); return null; }
  return u;
}

async function requireUser(req, res) {
  const user_id = req.body?.user_id || req.query?.user_id;
  if (!user_id) { res.status(401).json({ error: 'Não autorizado' }); return null; }
  const { data: u } = await sb.from('ck_users').select('id,role').eq('id', user_id).eq('active', 1).single();
  if (!u) { res.status(401).json({ error: 'Usuário inválido' }); return null; }
  return u;
}

// Identidade do REQUISITANTE sempre vem por query (?user_id=...), injetada pelo
// front em todas as chamadas — evita confundir com user_id que viaja no body
// (ex.: /api/shifts/bulk, onde body.user_id é o funcionário sendo escalado).
async function requireManager(req, res) {
  const user_id = req.query?.user_id || req.body?.user_id;
  if (!user_id) { res.status(401).json({ error: 'Não autorizado' }); return null; }
  const { data: u } = await sb.from('ck_users').select('id,role').eq('id', user_id).eq('active', 1).single();
  if (!u || (u.role !== 'admin' && u.role !== 'gerente')) { res.status(403).json({ error: 'Acesso restrito (admin/gerente)' }); return null; }
  return u;
}
async function requireAdminQ(req, res) {
  const user_id = req.query?.user_id || req.body?.user_id;
  if (!user_id) { res.status(401).json({ error: 'Não autorizado' }); return null; }
  const { data: u } = await sb.from('ck_users').select('id,role').eq('id', user_id).eq('active', 1).single();
  if (!u || u.role !== 'admin') { res.status(403).json({ error: 'Acesso restrito ao admin' }); return null; }
  return u;
}
const mwManager = (req, res, next) => requireManager(req, res).then(u => { if (u) next(); }).catch(() => res.status(500).json({ error: 'erro auth' }));
const mwAdmin = (req, res, next) => requireAdminQ(req, res).then(u => { if (u) next(); }).catch(() => res.status(500).json({ error: 'erro auth' }));
const mwUser = (req, res, next) => requireUser(req, res).then(u => { if (u) next(); }).catch(() => res.status(500).json({ error: 'erro auth' }));

// ===================== SEED =====================
let _seedDone = false;
async function seed() {
  if (_seedDone) return;
  _seedDone = true;
  const { count: uc } = await sb.from('ck_users').select('*', { count: 'exact', head: true });
  if (uc === 0) console.warn('⚠️  Nenhum usuário encontrado. Crie os usuários via painel admin ou SQL no Supabase.');
  const { count: tc } = await sb.from('ck_tasks').select('*', { count: 'exact', head: true });
  if (tc === 0) {
    const T = { abertura: { salao: [['Ligar disjuntor 1 e 2 para iluminação', null, 0], ['Abrir portas de vidro, portas de ferro e retirar a barra de ferro', null, 0], ['Colocar tapete e bandeira para fora', null, 0], ['Verificar se precisa lavar a calçada e molhar as plantas', null, 0], ['Limpeza do salão — varrer e passar pano', null, 0], ['Higienizar mesas e cadeiras', null, 1], ['Organizar e repor guardanapos, sal, açúcar e palito', null, 0], ['Ligar TV no volume 30, opção pendrive', null, 0], ['Verificar se as máquinas de cartão estão carregadas', null, 1], ['Ligar computador do caixa', null, 1], ['Verificar valor na balança e no sistema', null, 1]], cozinha: [['Ligar gás', null, 1], ['Ligar disjuntores: forno, exaustor e fritadeira', null, 1], ['Colocar lixo para fora', 'Seg, Qua, Sex e Dom', 0], ['Verificar temperatura dos freezers', null, 1], ['Higienizar bancadas e mesas para produção', null, 1], ['Organizar a praça e separar mise en place completa', null, 1], ['Verificar forno e fritadeira para produção', null, 0], ['Ligar exaustores quando começar a produzir', null, 0]], copa: [['Verificar gelo e repor as cubas', null, 0], ['Verificar e repor frutas', null, 0], ['Separar as frutas do dia para sucos', null, 0], ['Higienizar pratos e talheres', null, 1], ['Higienizar e organizar a copa', null, 1], ['Verificar tara da balança', null, 1], ['Verificar preço do sistema', null, 1]], banheiro: [['Higienizar vaso e mictório', null, 1], ['Verificar e repor papel higiênico', null, 1], ['Verificar e repor papel toalha', null, 1], ['Verificar e repor sabonete', null, 1], ['Higienizar pia de mármore', null, 1], ['Verificar e esvaziar lixeiras', null, 0]], gourmet: [['Ligar disjuntores 1, 2 e 3 de cima e o do meio de baixo', 'Meio=buffet · Cima=luz/rechaud/saladeira', 1], ['Limpar todos os rechauds com esponja e sabão', null, 1], ['Limpar buffet frio e quente', null, 1], ['Higienizar saladeiras', null, 1], ['Verificar e repor molhos', null, 0], ['Verificar nível de água em todos os rechauds e buffet', null, 1]] }, fechamento: { salao: [['Limpar e higienizar todas as mesas e cadeiras', null, 1], ['Varrer e passar pano no salão', null, 1], ['Recolher guardanapos, sal, açúcar e palito das mesas', null, 0], ['Desligar TV', null, 0], ['Conferir máquinas de cartão no carregador', null, 1], ['Fechar caixa no sistema e desligar computador', null, 1], ['Recolher tapete e bandeira', null, 0], ['Fechar portas de vidro, portas de ferro e colocar barra de ferro', null, 1], ['Desligar disjuntor 1 e 2 da iluminação', null, 1], ['Verificar se não ficaram pertences de clientes', null, 0]], cozinha: [['Desligar forno, fritadeira e exaustores', null, 1], ['Desligar gás', null, 1], ['Limpar e higienizar bancadas, mesas e equipamentos', null, 1], ['Armazenar sobras corretamente — etiquetar com data', null, 1], ['Verificar se freezers estão fechados e na temperatura correta', null, 1], ['Retirar lixo da cozinha', null, 0], ['Lavar piso da cozinha', null, 0], ['Desligar disjuntores: forno, exaustor e fritadeira', null, 1]], copa: [['Guardar frutas na geladeira', null, 1], ['Higienizar e guardar todos os pratos e talheres', null, 1], ['Limpar e secar bancadas da copa', null, 0], ['Descartar gelo restante e limpar cubas', null, 0], ['Limpar e organizar a copa para o dia seguinte', null, 0], ['Retirar lixo da copa', null, 0]], banheiro: [['Higienizar vaso e mictório', null, 1], ['Limpar pia de mármore e espelhos', null, 1], ['Verificar e repor papel higiênico para o dia seguinte', null, 1], ['Verificar e repor papel toalha', null, 1], ['Verificar e repor sabonete', null, 1], ['Esvaziar e limpar lixeiras', null, 0], ['Passar pano no piso do banheiro', null, 0]], gourmet: [['Desligar todos os rechauds e buffet', null, 1], ['Limpar e secar todos os rechauds', null, 1], ['Limpar buffet frio e quente', null, 1], ['Higienizar e guardar saladeiras', null, 1], ['Guardar molhos na geladeira', null, 1], ['Esvaziar e limpar água dos rechauds', null, 0], ['Desligar disjuntores 1, 2 e 3 de cima e o do meio de baixo', null, 1]] } };
    const rows = [];
    for (const [tab, secs] of Object.entries(T))
      for (const [sec, items] of Object.entries(secs))
        items.forEach((it, i) => rows.push({ sector_id: sec, tab, text: it[0], note: it[1] || null, sort_order: i, critical: it[2] || 0 }));
    for (let i = 0; i < rows.length; i += 50)
      await sb.from('ck_tasks').insert(rows.slice(i, i + 50));
  }
}

// ===================== AUTH =====================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' });
  const { data: user } = await sb.from('ck_users').select('id,username,name,role,sector,password').eq('username', username.toLowerCase()).eq('active', 1).single();
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  let match;
  if (user.password?.startsWith('$2')) {
    match = bcrypt.compareSync(password, user.password);
  } else {
    match = user.password === password;
    if (match) { const hash = bcrypt.hashSync(password, 10); await sb.from('ck_users').update({ password: hash }).eq('id', user.id); }
  }
  if (!match) return res.status(401).json({ error: 'Credenciais inválidas' });
  try { await sb.rpc('ck_upsert_attendance', { p_user_id: user.id, p_user_name: user.name, p_date: today(), p_check_in: nowTime() }); } catch (e) { }
  await sb.from('ck_activity_log').insert({ user_id: user.id, user_name: user.name, date: today(), time: nowTime(), action: 'login' });
  let alertCount = 0;
  if (user.role === 'admin' || user.role === 'gerente') {
    const { count } = await sb.from('ck_admin_alerts').select('*', { count: 'exact', head: true }).eq('seen', 0);
    alertCount = count || 0;
  }
  const { data: bulletins } = await sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false });
  const { password: _pw, ...safeUser } = user;
  res.json({ ...safeUser, alertCount, bulletins: bulletins || [] });
});

app.post('/api/ping', async (req, res) => {
  const { user_id, user_name } = req.body;
  try { await sb.rpc('ck_upsert_attendance', { p_user_id: user_id, p_user_name: user_name, p_date: today(), p_check_in: nowTime() }); } catch (e) { }
  await sb.from('ck_activity_log').insert({ user_id, user_name, date: today(), time: nowTime(), action: 'ping' });
  res.json({ ok: true });
});
app.get('/api/activity', async (req, res) => {
  const { data } = await sb.from('ck_activity_log').select('*').eq('date', req.query.date || today()).order('time', { ascending: false });
  res.json(data || []);
});
app.get('/api/activity/user/:id', async (req, res) => {
  const dates = datesBack(parseInt(req.query.days) || 7);
  const { data } = await sb.from('ck_activity_log').select('*').eq('user_id', req.params.id).in('date', dates).order('date', { ascending: false }).order('time', { ascending: false });
  res.json(data || []);
});
app.get('/api/sectors', async (req, res) => {
  const { data } = await sb.from('ck_sectors').select('*').order('sort_order');
  res.json(data || []);
});

// ===================== CHECKLIST =====================
app.get('/api/checklist/:tab', async (req, res) => {
  const { tab } = req.params, date = today(), dow = new Date().getDay();
  const [{ data: sectors }, { data: allTasks }, { data: allEntries }, { data: allFins }, { data: allShifts }] = await Promise.all([
    sb.from('ck_sectors').select('*').order('sort_order'),
    sb.from('ck_tasks').select('*').eq('tab', tab).eq('active', 1).order('sort_order'),
    sb.from('ck_checklist_entries').select('*').eq('date', date).eq('tab', tab),
    sb.from('ck_finalizations').select('*').eq('date', date).eq('tab', tab),
    sb.from('ck_shifts').select('user_id,sector_id').eq('day_of_week', dow)
  ]);
  const shiftUserIds = [...new Set((allShifts || []).map(s => s.user_id))];
  const { data: shiftUsers } = shiftUserIds.length ? await sb.from('ck_users').select('id,name').in('id', shiftUserIds).eq('active', 1) : { data: [] };
  const userMap = Object.fromEntries((shiftUsers || []).map(u => [u.id, u.name]));
  const entryByTask = Object.fromEntries((allEntries || []).map(e => [e.task_id, e]));
  const finBySector = Object.fromEntries((allFins || []).map(f => [f.sector_id, f]));
  const result = (sectors || []).map(s => {
    const tasks = (allTasks || []).filter(t => t.sector_id === s.id);
    const items = tasks.map(t => { const e = entryByTask[t.id]; return { id: t.id, text: t.text, note: t.note, critical: !!t.critical, done: e ? !!e.done : false, done_by: e?.done_by || null, done_at: e?.done_at || null, observation: e?.observation || null }; });
    const fin = finBySector[s.id];
    const assignedNames = (allShifts || []).filter(sh => sh.sector_id === s.id).map(sh => userMap[sh.user_id]).filter(Boolean);
    return { ...s, items, finalized: !!fin, finalizedBy: fin?.finalized_by || null, finalizedAt: fin?.finalized_at || null, signature: fin?.signature || null, assignedToday: assignedNames };
  });
  res.json(result);
});

app.post('/api/toggle', async (req, res) => {
  const { task_id, tab, user_name, user_id } = req.body, date = today();
  const { data: existing } = await sb.from('ck_checklist_entries').select('*').eq('task_id', task_id).eq('date', date).eq('tab', tab).maybeSingle();
  const { data: taskInfo } = await sb.from('ck_tasks').select('text').eq('id', task_id).single();
  if (existing && existing.done) {
    await sb.from('ck_checklist_entries').update({ done: 0, done_by: null, done_by_id: null, done_at: null }).eq('id', existing.id);
    await sb.from('ck_audit_log').insert({ action: 'uncheck', detail: `Desmarcou: "${taskInfo?.text}" (marcado por ${existing.done_by} às ${existing.done_at})`, user_name, user_id, date: today(), time: nowTime() });
    return res.json({ ok: true });
  }
  const { data: userRow } = await sb.from('ck_users').select('role').eq('id', user_id).single();
  if (userRow && (userRow.role === 'admin' || userRow.role === 'gerente')) {
    await sb.rpc('ck_upsert_checklist_entry', { p_task_id: task_id, p_date: date, p_tab: tab, p_done: 1, p_done_by: user_name, p_done_by_id: user_id, p_done_at: nowTime() });
    await sb.from('ck_audit_log').insert({ action: 'check', detail: `Marcou: "${taskInfo?.text}"`, user_name, user_id, date: today(), time: nowTime() });
    return res.json({ ok: true });
  }
  const oneMinAgo = new Date(Date.now() - 60 * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const { data: recent } = await sb.from('ck_checklist_entries').select('id,done_at').eq('done_by_id', user_id).eq('date', date).eq('done', 1).gte('done_at', oneMinAgo).order('done_at', { ascending: false });
  const recentCount = (recent || []).length;
  if (recentCount >= MAX_CHECKS_POR_MINUTO) {
    await sb.from('ck_admin_alerts').insert({ type: 'throttle', message: `${user_name} tentou marcar durante bloqueio`, user_name, user_id, date: today(), time: nowTime() });
    let retryAfterSeconds = 60;
    if (recent?.[recent.length - 1]?.done_at) {
      const oldest = recent[recent.length - 1].done_at;
      const [h, m] = oldest.split(':').map(Number);
      const now = new Date();
      const nowSP = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const secondsPassed = (nowSP.getHours() - h) * 3600 + (nowSP.getMinutes() - m) * 60 + nowSP.getSeconds();
      retryAfterSeconds = Math.max(1, 60 - secondsPassed);
    }
    return res.status(429).json({ error: 'Aguarde 1 minuto.', blocked: true, retryAfterSeconds });
  }
  await sb.rpc('ck_upsert_checklist_entry', { p_task_id: task_id, p_date: date, p_tab: tab, p_done: 1, p_done_by: user_name, p_done_by_id: user_id, p_done_at: nowTime() });
  await sb.from('ck_audit_log').insert({ action: 'check', detail: `Marcou: "${taskInfo?.text}"`, user_name, user_id, date: today(), time: nowTime() });
  res.json({ ok: true, remaining: MAX_CHECKS_POR_MINUTO - 1 - recentCount });
});

app.post('/api/observation', async (req, res) => {
  const { task_id, tab, observation } = req.body, date = today();
  await sb.rpc('ck_upsert_checklist_entry', { p_task_id: task_id, p_date: date, p_tab: tab, p_observation: observation || null });
  res.json({ ok: true });
});

app.post('/api/finalize', async (req, res) => {
  const { sector_id, tab, finalized_by, signature } = req.body, date = today();
  const { data: tasks } = await sb.from('ck_tasks').select('id,text').eq('sector_id', sector_id).eq('tab', tab).eq('active', 1).eq('critical', 1);
  const pending = [];
  for (const t of (tasks || [])) {
    const { data: e } = await sb.from('ck_checklist_entries').select('done').eq('task_id', t.id).eq('date', date).eq('tab', tab).maybeSingle();
    if (!e || !e.done) pending.push(t.text);
  }
  if (pending.length > 0) return res.status(400).json({ error: 'Tarefas obrigatórias pendentes', pending });
  try {
    await sb.rpc('ck_upsert_finalization', { p_sector_id: sector_id, p_date: date, p_tab: tab, p_finalized_by: finalized_by, p_finalized_at: nowTime(), p_signature: signature || null });
    await sb.from('ck_audit_log').insert({ action: 'finalize', detail: `Finalizou setor ${sector_id} (${tab})`, user_name: finalized_by, user_id: null, date: today(), time: nowTime() });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/bulletin', async (req, res) => { const { data } = await sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false }); res.json(data || []); });
app.post('/api/bulletin', mwManager, async (req, res) => { const { title, message, priority, created_by } = req.body; await sb.from('ck_bulletin').insert({ title, message, created_by, created_at: nowTime(), date: today(), priority: priority || 'normal' }); res.json({ ok: true }); });
app.put('/api/bulletin/:id', mwManager, async (req, res) => { await sb.from('ck_bulletin').update({ title: req.body.title, message: req.body.message, priority: req.body.priority || 'normal' }).eq('id', req.params.id); res.json({ ok: true }); });
app.delete('/api/bulletin/:id', mwManager, async (req, res) => { await sb.from('ck_bulletin').update({ active: 0 }).eq('id', req.params.id); res.json({ ok: true }); });

app.get('/api/audit', mwManager, async (req, res) => { const { data } = await sb.from('ck_audit_log').select('*').in('date', datesBack(parseInt(req.query.days) || 3)).order('id', { ascending: false }).limit(100); res.json(data || []); });

app.get('/api/occurrences', async (req, res) => { const { data } = await sb.from('ck_occurrences').select('*').in('date', datesBack(parseInt(req.query.days) || 7)).order('id', { ascending: false }); res.json(data || []); });
app.post('/api/occurrences', async (req, res) => { await sb.from('ck_occurrences').insert({ text: req.body.text, category: req.body.category || 'geral', priority: req.body.priority || 'normal', created_by: req.body.created_by, created_at: nowTime(), date: today() }); res.json({ ok: true }); });
app.post('/api/occurrences/:id/resolve', async (req, res) => { await sb.from('ck_occurrences').update({ resolved: 1, resolved_by: req.body.resolved_by, resolved_at: nowTime() }).eq('id', req.params.id); res.json({ ok: true }); });
app.delete('/api/occurrences/:id', mwManager, async (req, res) => { await sb.from('ck_occurrences').delete().eq('id', req.params.id); res.json({ ok: true }); });

// ===================== DASHBOARD =====================
app.get('/api/dashboard', async (req, res) => {
  const date = today(), d7 = datesBack(7);
  const [{ data: sectors }, { data: allTasks }, { data: todayEntries }, { data: todayFins }, { count: presentToday }, { count: openOccurrences }, { data: tempAlertData }, { data: expiryData }, { data: bulletins }, { data: weekEntries }] = await Promise.all([
    sb.from('ck_sectors').select('*').order('sort_order'),
    sb.from('ck_tasks').select('id,sector_id,tab').eq('active', 1),
    sb.from('ck_checklist_entries').select('task_id,tab').eq('date', date).eq('done', 1),
    sb.from('ck_finalizations').select('sector_id,tab,finalized_by,finalized_at').eq('date', date),
    sb.from('ck_attendance').select('*', { count: 'exact', head: true }).eq('date', date),
    sb.from('ck_occurrences').select('*', { count: 'exact', head: true }).eq('resolved', 0),
    sb.from('ck_temperature_logs').select('id').eq('date', date).eq('alert', 1),
    sb.from('ck_expiry_items').select('id,expiry_date').eq('replaced', 0),
    sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false }),
    sb.from('ck_checklist_entries').select('task_id,tab,date').in('date', d7).eq('done', 1),
  ]);
  const doneToday = new Set((todayEntries || []).map(e => `${e.task_id}|${e.tab}`));
  const todayStats = {};
  for (const tab of ['abertura', 'fechamento']) {
    todayStats[tab] = (sectors || []).map(sc => {
      const tasks = (allTasks || []).filter(t => t.sector_id === sc.id && t.tab === tab);
      const done = tasks.filter(t => doneToday.has(`${t.id}|${tab}`)).length;
      const fin = (todayFins || []).find(f => f.sector_id === sc.id && f.tab === tab);
      return { id: sc.id, name: sc.name, icon: sc.icon, total: tasks.length, done, finalized: !!fin };
    });
  }
  const totalPerDay = (allTasks || []).length;
  const doneByDate = {};
  (weekEntries || []).forEach(e => { doneByDate[e.date] = (doneByDate[e.date] || 0) + 1; });
  const weeklyRates = d7.map(dt => ({ date: dt, pct: totalPerDay ? Math.round((doneByDate[dt] || 0) / totalPerDay * 100) : 0 }));
  const expiringCount = (expiryData || []).filter(i => Math.ceil((new Date(i.expiry_date) - new Date(date)) / 86400000) <= 5).length;
  res.json({ todayStats, weeklyRates, presentToday: presentToday || 0, openOccurrences: openOccurrences || 0, tempAlerts: (tempAlertData || []).length, expiringCount, bulletins: bulletins || [] });
});

app.get('/api/alerts', mwManager, async (req, res) => { const { data } = await sb.from('ck_admin_alerts').select('*').in('date', datesBack(3)).order('id', { ascending: false }); res.json(data || []); });
app.post('/api/alerts/seen', mwManager, async (req, res) => { await sb.from('ck_admin_alerts').update({ seen: 1 }).eq('seen', 0); res.json({ ok: true }); });
app.get('/api/settings', async (req, res) => { const { data } = await sb.from('ck_settings').select('*'); const obj = {}; (data || []).forEach(r => obj[r.key] = r.value); res.json(obj); });
app.post('/api/settings', mwManager, async (req, res) => { await sb.rpc('ck_upsert_setting', { p_key: req.body.key, p_value: req.body.value }); res.json({ ok: true }); });

// ===================== TEMPERATURE =====================
app.get('/api/temperatures', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  const { data } = await sb.from('ck_temperature_logs').select('*').eq('date', req.query.date || today()).order('time', { ascending: false });
  res.json(data || []);
});
app.post('/api/temperatures', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  const { equipment, temperature, min_temp, max_temp, logged_by } = req.body;
  const temp = parseFloat(temperature), mn = parseFloat(min_temp) || -25, mx = parseFloat(max_temp) || -10;
  const alert = (temp < mn || temp > mx) ? 1 : 0;
  await sb.from('ck_temperature_logs').insert({ equipment, temperature: temp, min_temp: mn, max_temp: mx, date: today(), time: nowTime(), logged_by, alert });
  if (alert) await sb.from('ck_admin_alerts').insert({ type: 'temperature', message: `🌡️ ${equipment}: ${temp}°C fora da faixa`, user_name: logged_by, user_id: req.body.user_id, date: today(), time: nowTime() });
  res.json({ ok: true, alert });
});

app.get('/api/expiry', async (req, res) => {
  const { data: items } = await sb.from('ck_expiry_items').select('*').order('expiry_date');
  const t = today();
  res.json((items || []).map(i => { const dl = Math.ceil((new Date(i.expiry_date) - new Date(t)) / 86400000); let st = 'ok'; if (i.replaced) st = 'replaced'; else if (dl < 0) st = 'vencido'; else if (dl <= 3) st = 'critico'; else if (dl <= 5) st = 'atencao'; return { ...i, daysLeft: dl, status: st }; }));
});
app.post('/api/expiry', async (req, res) => { await sb.from('ck_expiry_items').insert({ name: req.body.name, category: req.body.category || 'geral', expiry_date: req.body.expiry_date, quantity: req.body.quantity || null, added_by: req.body.added_by, added_at: nowTime() }); res.json({ ok: true }); });
app.put('/api/expiry/:id', async (req, res) => { if (req.body.update_date_only) await sb.from('ck_expiry_items').update({ expiry_date: req.body.expiry_date, replaced: 0, replaced_by: null, replaced_at: null, new_expiry_date: null }).eq('id', req.params.id); else await sb.from('ck_expiry_items').update({ name: req.body.name, category: req.body.category, expiry_date: req.body.expiry_date, quantity: req.body.quantity || null }).eq('id', req.params.id); res.json({ ok: true }); });
app.post('/api/expiry/:id/replace', async (req, res) => { await sb.from('ck_expiry_items').update({ replaced: 1, replaced_by: req.body.replaced_by, replaced_at: nowTime(), new_expiry_date: req.body.new_expiry_date || null }).eq('id', req.params.id); res.json({ ok: true }); });
app.post('/api/expiry/:id/unreplace', async (req, res) => { const { data: it } = await sb.from('ck_expiry_items').select('*').eq('id', req.params.id).single(); if (it?.new_expiry_date) await sb.from('ck_expiry_items').update({ replaced: 0, replaced_by: null, replaced_at: null, expiry_date: it.new_expiry_date, new_expiry_date: null }).eq('id', req.params.id); else await sb.from('ck_expiry_items').update({ replaced: 0, replaced_by: null, replaced_at: null }).eq('id', req.params.id); res.json({ ok: true }); });
app.delete('/api/expiry/:id', async (req, res) => { await sb.from('ck_expiry_items').delete().eq('id', req.params.id); res.json({ ok: true }); });
app.get('/api/attendance', async (req, res) => { const { data } = await sb.from('ck_attendance').select('*').in('date', datesBack(parseInt(req.query.days) || 7)).order('date', { ascending: false }).order('check_in'); res.json(data || []); });
app.get('/api/attendance/today', async (req, res) => { const { data } = await sb.from('ck_attendance').select('*').eq('date', today()).order('check_in'); res.json(data || []); });
app.get('/api/shifts', async (req, res) => {
  const { data: shifts } = await sb.from('ck_shifts').select('*');
  if (!shifts?.length) return res.json([]);
  const userIds = [...new Set(shifts.map(s => s.user_id))];
  const sectorIds = [...new Set(shifts.map(s => s.sector_id))];
  const [{ data: users }, { data: secs }] = await Promise.all([sb.from('ck_users').select('id,name').in('id', userIds).eq('active', 1), sb.from('ck_sectors').select('id,name,icon').in('id', sectorIds)]);
  const um = Object.fromEntries((users || []).map(u => [u.id, u.name]));
  const sm = Object.fromEntries((secs || []).map(s => [s.id, s]));
  res.json(shifts.filter(s => um[s.user_id] && sm[s.sector_id]).map(s => ({ ...s, user_name: um[s.user_id], sector_name: sm[s.sector_id].name, sector_icon: sm[s.sector_id].icon })));
});
app.post('/api/shifts/bulk', mwManager, async (req, res) => { const { user_id, assignments } = req.body; await sb.from('ck_shifts').delete().eq('user_id', user_id); if (assignments?.length) await sb.from('ck_shifts').insert(assignments.map(a => ({ user_id, sector_id: a.sector_id, day_of_week: a.day_of_week }))); res.json({ ok: true }); });
app.get('/api/ranking', async (req, res) => {
  const dates = datesBack(parseInt(req.query.days) || 7);
  const { data: rvRow } = await sb.from('ck_settings').select('value').eq('key', 'ranking_visible').maybeSingle();
  const rv = rvRow?.value === '1';
  const [{ data: entries }, { data: att }, { data: fins }, { data: eb }] = await Promise.all([
    sb.from('ck_checklist_entries').select('done_by').eq('done', 1).in('date', dates).not('done_by', 'is', null),
    sb.from('ck_attendance').select('user_name').in('date', dates),
    sb.from('ck_finalizations').select('finalized_by').in('date', dates),
    sb.from('ck_attendance').select('user_name,check_in').in('date', dates)
  ]);
  const taskMap = {}; (entries || []).forEach(e => { taskMap[e.done_by] = (taskMap[e.done_by] || 0) + 1; });
  const taskRanking = Object.entries(taskMap).map(([name, tasks_done]) => ({ name, tasks_done })).sort((a, b) => b.tasks_done - a.tasks_done);
  const attMap = {}; (att || []).forEach(a => { attMap[a.user_name] = (attMap[a.user_name] || 0) + 1; });
  const attendanceRanking = Object.entries(attMap).map(([name, days_present]) => ({ name, days_present })).sort((a, b) => b.days_present - a.days_present);
  const finMap = {}; (fins || []).forEach(f => { finMap[f.finalized_by] = (finMap[f.finalized_by] || 0) + 1; });
  const finalizationRanking = Object.entries(finMap).map(([name, sectors_finalized]) => ({ name, sectors_finalized })).sort((a, b) => b.sectors_finalized - a.sectors_finalized);
  const ebMap = {}; (eb || []).forEach(e => { if (!ebMap[e.user_name] || e.check_in < ebMap[e.user_name]) ebMap[e.user_name] = e.check_in; });
  const earlyBird = Object.entries(ebMap).map(([name, earliest]) => ({ name, earliest })).sort((a, b) => a.earliest.localeCompare(b.earliest));
  res.json({ rankingVisible: rv, taskRanking, attendanceRanking, finalizationRanking, earlyBird, period: dates.length });
});
app.get('/api/reports', async (req, res) => {
  const dates = datesBack(parseInt(req.query.days) || 7);
  const { data: sectors } = await sb.from('ck_sectors').select('*').order('sort_order');
  const result = [];
  for (const date of dates) {
    const tabs = [];
    for (const tab of ['abertura', 'fechamento']) {
      const secData = [];
      for (const s of (sectors || [])) {
        const { count: total } = await sb.from('ck_tasks').select('*', { count: 'exact', head: true }).eq('sector_id', s.id).eq('tab', tab).eq('active', 1);
        const { data: taskIds } = await sb.from('ck_tasks').select('id').eq('sector_id', s.id).eq('tab', tab).eq('active', 1);
        let done = 0;
        if (taskIds?.length) { const { count } = await sb.from('ck_checklist_entries').select('*', { count: 'exact', head: true }).in('task_id', taskIds.map(t => t.id)).eq('date', date).eq('tab', tab).eq('done', 1); done = count || 0; }
        const { data: fin } = await sb.from('ck_finalizations').select('*').eq('sector_id', s.id).eq('date', date).eq('tab', tab).maybeSingle();
        secData.push({ id: s.id, name: s.name, icon: s.icon, total: total || 0, done, finalized: !!fin, finalizedBy: fin?.finalized_by || null, finalizedAt: fin?.finalized_at || null });
      }
      tabs.push({ tab, sectors: secData });
    }
    const { data: attendance } = await sb.from('ck_attendance').select('user_name,check_in,check_out').eq('date', date).order('check_in');
    result.push({ date, tabs, attendance: attendance || [] });
  }
  res.json(result);
});
app.get('/api/reports/:date/:tab', async (req, res) => {
  const { date, tab } = req.params;
  const { data: sectors } = await sb.from('ck_sectors').select('*').order('sort_order');
  const result = [];
  for (const s of (sectors || [])) {
    const { data: tasks } = await sb.from('ck_tasks').select('*').eq('sector_id', s.id).eq('tab', tab).eq('active', 1).order('sort_order');
    const items = [];
    for (const t of (tasks || [])) { const { data: e } = await sb.from('ck_checklist_entries').select('*').eq('task_id', t.id).eq('date', date).eq('tab', tab).maybeSingle(); items.push({ text: t.text, critical: !!t.critical, done: e ? !!e.done : false, done_by: e?.done_by || null, done_at: e?.done_at || null, observation: e?.observation || null }); }
    const { data: fin } = await sb.from('ck_finalizations').select('*').eq('sector_id', s.id).eq('date', date).eq('tab', tab).maybeSingle();
    result.push({ ...s, items, finalized: !!fin, finalizedBy: fin?.finalized_by || null, finalizedAt: fin?.finalized_at || null });
  }
  res.json(result);
});
app.get('/api/export/pdf', (req, res) => { res.redirect(`/api/reports/${req.query.date || today()}/abertura`); });

// ===================== ADMIN =====================
app.get('/api/users', mwUser, async (req, res) => { const { data } = await sb.from('ck_users').select('id,username,name,role,sector,active').order('name'); res.json(data || []); });
app.post('/api/users', mwManager, async (req, res) => { const hash = bcrypt.hashSync(req.body.password, 10); const { error } = await sb.from('ck_users').insert({ username: req.body.username.toLowerCase(), password: hash, name: req.body.name, role: req.body.role || 'operador', sector: req.body.sector || null }); if (error) return res.status(400).json({ error: 'Usuário já existe' }); res.json({ ok: true }); });
app.put('/api/users/:id', mwManager, async (req, res) => { const updates = {}; ['name', 'role', 'sector', 'active'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; }); if (req.body.password) updates.password = bcrypt.hashSync(req.body.password, 10); if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada' }); await sb.from('ck_users').update(updates).eq('id', req.params.id); res.json({ ok: true }); });
app.delete('/api/users/:id', mwAdmin, async (req, res) => { await sb.from('ck_users').delete().eq('id', req.params.id); res.json({ ok: true }); });
app.get('/api/tasks', mwManager, async (req, res) => { const { data } = await sb.from('ck_tasks').select('*').eq('active', 1).order('tab').order('sector_id').order('sort_order'); res.json(data || []); });
app.post('/api/tasks', mwManager, async (req, res) => { const { data: maxRow } = await sb.from('ck_tasks').select('sort_order').eq('sector_id', req.body.sector_id).eq('tab', req.body.tab).order('sort_order', { ascending: false }).limit(1).maybeSingle(); await sb.from('ck_tasks').insert({ sector_id: req.body.sector_id, tab: req.body.tab, text: req.body.text, note: req.body.note || null, sort_order: (maxRow?.sort_order || 0) + 1, critical: req.body.critical ? 1 : 0 }); res.json({ ok: true }); });
app.put('/api/tasks/:id', mwManager, async (req, res) => { await sb.from('ck_tasks').update({ text: req.body.text, note: req.body.note || null, critical: req.body.critical ? 1 : 0 }).eq('id', req.params.id); res.json({ ok: true }); });
app.delete('/api/tasks/:id', mwManager, async (req, res) => { await sb.from('ck_tasks').update({ active: 0 }).eq('id', req.params.id); res.json({ ok: true }); });

app.post('/api/reset-day', async (req, res) => {
  const u = await requireAdmin(req, res); if (!u) return;
  const d = today();
  await sb.from('ck_checklist_entries').delete().eq('date', d);
  await sb.from('ck_finalizations').delete().eq('date', d);
  await sb.from('ck_temperature_logs').delete().eq('date', d);
  res.json({ ok: true });
});

// ===================== AGENTS =====================
const N8N_BASE = process.env.N8N_URL || 'https://n8n-production-806f.up.railway.app';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MWI4ZThmYy02NDI0LTQ3MzQtYTNhZC1lOGZkNGViOTVjMjEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNGE3ODA5NDItZWRhMS00NzUxLWFkZTgtYjdhOTJmMzMxY2M0IiwiaWF0IjoxNzc4OTQ3NzM2LCJleHAiOjE3ODE0OTYwMDB9.xNDtcsU2SeYOp2q8fZDddZRWbP1A2K6TNTbaWoXra8g';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;
const N8N_MAESTRO_URL = process.env.N8N_MAESTRO_URL || `${N8N_BASE}/webhook/toca/maestro`;

const AGENTS = {
  maestro:     { id: 'EoQGijYOO3JkJHfm', name: 'Maestro',      icon: '🎯' },
  financeiro:  { id: 'MfdiGE0xILMSugfN', name: 'Financeiro',   icon: '💰' },
  estoque:     { id: 'unuiStRhn4t0hdp7', name: 'Estoque',       icon: '📦' },
  cardapio:    { id: '7IkIEmk3AOw4Yjvl', name: 'Cardápio',     icon: '🍽️' },
  marketing:   { id: 'aR6jALrkJQE99Kjz', name: 'Marketing',    icon: '📣' },
  socialmedia: { id: 'leVDwERQRq4lriF6', name: 'Social Media', icon: '📱' },
  atendimento: { id: 'JoAGWvLRhzLDCIGJ', name: 'Atendimento',  icon: '🤝' },
  rh:          { id: 'kq3Cd8bWaFvbm3gt', name: 'RH',           icon: '👥' },
  operacional: { id: 'jL5rv6ZKz6BvWIN7', name: 'Operacional',  icon: '⚙️' },
  auditoria:   { id: 'vg6igoh0KtyjhMPx', name: 'Auditoria',    icon: '🔍' }
};

app.get('/api/agents/status', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  if (!N8N_API_KEY) {
    return res.json(Object.entries(AGENTS).map(([key, a]) => ({ key, ...a, active: false })));
  }
  try {
    const results = await Promise.all(
      Object.values(AGENTS).map(a =>
        fetch(`${N8N_BASE}/api/v1/workflows/${a.id}`, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } })
          .then(r => r.json()).catch(() => null)
      )
    );
    const statusMap = Object.fromEntries(results.filter(Boolean).map(w => [w.id, w.active]));
    res.json(Object.entries(AGENTS).map(([key, a]) => ({ key, ...a, active: statusMap[a.id] ?? false })));
  } catch (e) {
    res.json(Object.entries(AGENTS).map(([key, a]) => ({ key, ...a, active: false })));
  }
});

app.post('/api/agents/trigger', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  const { event, payload, user_name } = req.body;
  if (!event) return res.status(400).json({ error: 'event obrigatório' });
  try {
    const r = await fetch(N8N_MAESTRO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET ? { 'X-Toca-Secret': N8N_WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify({
        event,
        source: 'checklist',
        timestamp: new Date().toISOString(),
        user: { id: u.id, name: user_name || 'Sistema' },
        ...(payload || {})
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: 'Agente retornou erro', details: data });
    await sb.from('ck_audit_log').insert({
      action: 'agent_trigger',
      detail: `Evento "${event}" enviado ao Maestro`,
      user_name: user_name || 'Sistema',
      user_id: u.id,
      date: today(),
      time: nowTime()
    });
    res.json({ ok: true, response: data });
  } catch (e) {
    res.status(503).json({ error: 'Falha ao contatar Maestro', details: e.message });
  }
});

// ===================== ESCALA IA (admin-only) =====================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const REGRAS_ESCALA = `Você monta a ESCALA SEMANAL de funcionários do Restaurante Toca do Coelho (São Gonçalo/RJ).
A semana vai de SEGUNDA a DOMINGO. Use SEMPRE a escala anterior enviada para dar continuidade às folgas, alternâncias e ao dia-sim-dia-não. Se a escala anterior não vier, avise e marque suposições com [VERIFICAR].

== GARÇONS / SALÃO ==
Garçons: Leonardo, Gabriel, Tiago, Wellington.
- Leonardo trabalha em dia sim / dia não, continuando a sequência da última escala.
- Seg a Sex: 2 garçons por dia.
- Sábado: 3 garçons.
- Domingo: 4 garçons (todos).
- Cada garçom deve trabalhar pelo menos 4 dias na semana (salvo exceção necessária).

== COPA ==
- Yasmim é da COPA (não da cozinha). Liste-a SEMPRE separada, em uma linha "Copa:" própria, afastada da cozinha.
- Yasmim folga toda SEGUNDA.
- Yasmim folga também no SEGUNDO DOMINGO do mês.
- Quando Yasmim estiver de folga, Paulo (auxiliar) NÃO pode estar de folga (ele cobre a Copa).

== COZINHA — COZINHEIROS ==
Cozinheiros em RODÍZIO: Davisson, Fabrício, Igor.  Cozinheiro FIXO: Jorge.
- Segunda a sexta: 2 cozinheiros por dia, INTERCALANDO Davisson, Fabrício e Igor (reveze quem trabalha e quem folga, de forma justa, com base na escala anterior).
- Davisson, Fabrício e Igor: NO MÁXIMO 5 dias por semana CADA. NUNCA 6 dias para nenhum deles.
- Jorge é o ÚNICO cozinheiro 6x1: folga fixa toda QUARTA e também no 2º DOMINGO do mês. Pode trabalhar 6 dias.
- Nunca menos de 2 cozinheiros em nenhum dia. Sábado e domingo podem ter mais de 2 (são mais movimentados).

== COZINHA — AUXILIARES ==
Auxiliares: Paulo, Adriana, Márcia, Paulo Novo.
- Paulo é INTEGRAL, 6x1: folga fixa toda QUINTA e também no 3º DOMINGO do mês. Pode trabalhar 6 dias.
- Adriana, Márcia e Paulo Novo: NO MÁXIMO 4 dias por semana CADA, em rodízio (sem folga fixa — varie as folgas toda semana).
- Prioridade: Paulo Novo trabalha aos DOMINGOS (geralmente fica na Limpeza).
- Nunca menos de 2 auxiliares por dia. Quando a Yasmim folga, o Paulo NÃO pode folgar (ele cobre a Copa).

== COMO DESCOBRIR O DOMINGO DO MÊS ==
Conte os domingos dentro do mês civil: 1º domingo = primeiro domingo do mês; 2º = segundo; 3º = terceiro. Aplique as folgas mensais (Yasmim 2º dom, Jorge 2º dom, Paulo 3º dom) conforme a data real de cada domingo da semana.

== PAPÉIS NO QUADRO (como distribuir cada pessoa no dia) ==
- "cozinha": cozinheiros + auxiliares que trabalham no dia. NÃO inclua aqui quem está em limpeza nem na copa.
- "limpeza": Paulo Novo quando trabalha (senão null).
- "copa": Yasmim normalmente; Paulo quando a Yasmim folga (senão null).
- "garcons": garçons que trabalham no dia.

== SAÍDA — responda SOMENTE um JSON válido (sem crases, sem nada fora do JSON) ==
{
  "semana": "DD/MM a DD/MM/AAAA",
  "dias": [
    {"data":"DD/MM","dia":"Segunda","cozinha":["Nome"],"limpeza":"Nome ou null","copa":"Nome ou null","garcons":["Nome"]}
  ],
  "conferencia": {
    "cozinheiros":[{"nome":"Fabrício","dias":0}],
    "auxiliares":[{"nome":"Paulo","dias":0}],
    "copa":[{"nome":"Yasmim","dias":0}],
    "garcons":[{"nome":"Leonardo","dias":0}]
  },
  "conflitos": ["descreva cada conflito; use [] se nenhum"]
}
O array "dias" deve ter EXATAMENTE 7 itens, de Segunda a Domingo.
ANTES de responder, VALIDE e CORRIJA: (a) só Jorge (cozinha) e Paulo (auxiliar) podem ter 6 dias; (b) Davisson, Fabrício e Igor no MÁXIMO 5 dias cada; (c) Adriana, Márcia e Paulo Novo no MÁXIMO 4 dias cada; (d) todo dia com pelo menos 2 cozinheiros e 2 auxiliares. Se algo violar, REFAÇA a distribuição antes de responder. Confira você mesmo as contagens. Responda só o JSON.`;

// Converte a escala estruturada (dados) em texto legível p/ servir de base à IA
function escalaParaTexto(d) {
  if (!d || !Array.isArray(d.dias)) return '';
  const linhas = [d.semana ? `Semana ${d.semana}` : ''];
  for (const x of d.dias) {
    const p = [`${x.dia} ${x.data}`, `Cozinha: ${(x.cozinha || []).join(', ') || '—'}`];
    if (x.limpeza) p.push(`Limpeza: ${x.limpeza}`);
    p.push(`Copa: ${x.copa || '—'}`);
    p.push(`Garçons: ${(x.garcons || []).join(', ') || '—'}`);
    linhas.push(p.join(' | '));
  }
  return linhas.filter(Boolean).join('\n');
}

app.post('/api/escala/gerar', mwAdmin, async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada. Adicione essa variável no serviço do Railway para usar a Escala IA.' });
  const { semana_inicio, semana_fim, observacoes } = req.body || {};
  if (!semana_inicio || !semana_fim) return res.status(400).json({ error: 'Informe o início e o fim da semana.' });
  // Base = última escala PUBLICADA (automática). Aceita escala_anterior no corpo como override.
  let baseTexto = ((req.body && req.body.escala_anterior) || '').trim();
  if (!baseTexto) {
    try {
      const { data: ult } = await sb.from('ck_escala').select('dados').order('publicado_em', { ascending: false }).limit(1).maybeSingle();
      if (ult && ult.dados) baseTexto = escalaParaTexto(ult.dados);
    } catch (e) {}
  }
  const userMsg =
    `Monte a escala da semana de ${semana_inicio} a ${semana_fim}.\n\n` +
    (baseTexto
      ? `ESCALA ANTERIOR (base para continuidade de folgas, alternâncias e dia-sim-dia-não):\n${baseTexto}\n\n`
      : `ATENÇÃO: não há escala anterior registrada. Faça a melhor suposição e marque com [VERIFICAR].\n\n`) +
    (observacoes && observacoes.trim() ? `OBSERVAÇÕES DESTA SEMANA: ${observacoes.trim()}\n\n` : '') +
    `Siga TODAS as regras e responda EXATAMENTE no formato pedido (JSON).`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: REGRAS_ESCALA, messages: [{ role: 'user', content: userMsg }] })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Erro na IA: ' + (data?.error?.message || r.status) });
    let texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    // Extrai o JSON da resposta (remove cercas ``` se houver)
    let dados = null;
    try {
      let js = texto.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      const a = js.indexOf('{'), b = js.lastIndexOf('}');
      if (a >= 0 && b > a) js = js.slice(a, b + 1);
      dados = JSON.parse(js);
    } catch (e) { dados = null; }
    if (!dados || !Array.isArray(dados.dias)) return res.status(502).json({ error: 'A IA não devolveu a escala no formato esperado. Tente "Gerar de novo".' });
    try { await sb.from('ck_audit_log').insert({ action: 'escala_ia', detail: `Gerou escala ${semana_inicio} a ${semana_fim}`, user_name: req.query.user_name || 'admin', user_id: req.query.user_id || null, date: today(), time: nowTime() }); } catch (e) {}
    res.json({ ok: true, dados });
  } catch (e) {
    res.status(503).json({ error: 'Falha ao contatar a IA: ' + e.message });
  }
});

// Publica a escala gerada no "quadro da Equipe" (visível a todos os logados)
app.post('/api/escala/publicar', mwAdmin, async (req, res) => {
  const { dados } = req.body || {};
  if (!dados || !Array.isArray(dados.dias)) return res.status(400).json({ error: 'Escala inválida.' });
  await sb.from('ck_escala').insert({ semana: dados.semana || null, dados, publicado_por: req.query.user_name || 'admin' });
  res.json({ ok: true });
});
app.get('/api/escala/atual', mwUser, async (req, res) => {
  const { data } = await sb.from('ck_escala').select('dados,semana,publicado_em,publicado_por').order('publicado_em', { ascending: false }).limit(1).maybeSingle();
  res.json(data || null);
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

seed().then(() => {
  app.listen(PORT, () => console.log(`Toca do Coelho rodando na porta ${PORT} (Supabase)`));
}).catch(e => {
  console.error('Erro no seed:', e);
  app.listen(PORT, () => console.log(`Toca do Coelho rodando na porta ${PORT} (seed falhou)`));
});
