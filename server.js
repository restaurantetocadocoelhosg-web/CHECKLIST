const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const SUPA_URL = process.env.SUPABASE_URL || 'https://zuwdgyvbuaocbzckhhlm.supabase.co';
const SUPA_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1d2RneXZidWFvY2J6Y2toaGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODk0MTUsImV4cCI6MjA5MjI2NTQxNX0._v0lytkvd854urjD0l45rX9vrzSUh0Ro2VuGINsLwmM';

const sb = createClient(SUPA_URL, SUPA_KEY);

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function today() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
function datesBack(n) { const d = []; for (let i = 0; i < n; i++) { const dt = new Date(); dt.setDate(dt.getDate() - i); d.push(dt.toISOString().slice(0, 10)); } return d; }

// ===================== SEED =====================
async function seed() {
  const { count } = await sb.from('ck_users').select('*', { count: 'exact', head: true });
  if (count === 0) {
    await sb.from('ck_users').insert([
      { username: 'nayara', password: 'nay123', name: 'Nayara', role: 'admin', sector: null },
      { username: 'simone', password: 'sim123', name: 'Simone', role: 'gerente', sector: null },
      { username: 'neia', password: 'neia123', name: 'Neia', role: 'gerente', sector: null },
      { username: 'thiago', password: 'thi123', name: 'Thiago', role: 'operador', sector: 'salao' },
      { username: 'leonardo', password: 'leo123', name: 'Leonardo', role: 'operador', sector: 'salao' },
      { username: 'deivison', password: 'dei123', name: 'Deivison', role: 'operador', sector: 'cozinha' },
      { username: 'paulo', password: 'pau123', name: 'Paulo', role: 'operador', sector: 'cozinha' },
      { username: 'jorge', password: 'jor123', name: 'Jorge', role: 'operador', sector: 'cozinha' }
    ]);
  }
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
  const { data: user } = await sb.from('ck_users').select('id,username,name,role,sector').eq('username', username?.toLowerCase()).eq('password', password).eq('active', 1).single();
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  try { await sb.rpc('ck_upsert_attendance', { p_user_id: user.id, p_user_name: user.name, p_date: today(), p_check_in: nowTime() }); } catch (e) { }
  await sb.from('ck_activity_log').insert({ user_id: user.id, user_name: user.name, date: today(), time: nowTime(), action: 'login' });
  let alertCount = 0;
  if (user.role === 'admin' || user.role === 'gerente') {
    const { count } = await sb.from('ck_admin_alerts').select('*', { count: 'exact', head: true }).eq('seen', 0);
    alertCount = count || 0;
  }
  const { data: bulletins } = await sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false });
  res.json({ ...user, alertCount, bulletins: bulletins || [] });
});

// ACTIVITY PING
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
  const { data: sectors } = await sb.from('ck_sectors').select('*').order('sort_order');
  const result = [];
  for (const s of (sectors || [])) {
    const { data: tasks } = await sb.from('ck_tasks').select('*').eq('sector_id', s.id).eq('tab', tab).eq('active', 1).order('sort_order');
    const items = [];
    for (const t of (tasks || [])) {
      const { data: e } = await sb.from('ck_checklist_entries').select('*').eq('task_id', t.id).eq('date', date).eq('tab', tab).maybeSingle();
      items.push({ id: t.id, text: t.text, note: t.note, critical: !!t.critical, done: e ? !!e.done : false, done_by: e?.done_by || null, done_at: e?.done_at || null, observation: e?.observation || null });
    }
    const { data: fin } = await sb.from('ck_finalizations').select('*').eq('sector_id', s.id).eq('date', date).eq('tab', tab).maybeSingle();
    const { data: assigned } = await sb.from('ck_shifts').select('user_id').eq('sector_id', s.id).eq('day_of_week', dow);
    const assignedNames = [];
    for (const a of (assigned || [])) {
      const { data: u } = await sb.from('ck_users').select('name').eq('id', a.user_id).eq('active', 1).maybeSingle();
      if (u) assignedNames.push(u.name);
    }
    result.push({ ...s, items, finalized: !!fin, finalizedBy: fin?.finalized_by || null, finalizedAt: fin?.finalized_at || null, signature: fin?.signature || null, assignedToday: assignedNames });
  }
  res.json(result);
});

// TOGGLE
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
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const { data: recent } = await sb.from('ck_checklist_entries').select('id').eq('done_by_id', user_id).eq('date', date).eq('done', 1).gte('done_at', fiveMinAgo);
  const recentCount = (recent || []).length;
  if (recentCount >= 2) {
    await sb.from('ck_admin_alerts').insert({ type: 'throttle', message: `${user_name} tentou marcar durante bloqueio`, user_name, user_id, date: today(), time: nowTime() });
    return res.status(429).json({ error: 'Aguarde 5 minutos.', blocked: true });
  }
  await sb.rpc('ck_upsert_checklist_entry', { p_task_id: task_id, p_date: date, p_tab: tab, p_done: 1, p_done_by: user_name, p_done_by_id: user_id, p_done_at: nowTime() });
  await sb.from('ck_audit_log').insert({ action: 'check', detail: `Marcou: "${taskInfo?.text}"`, user_name, user_id, date: today(), time: nowTime() });
  res.json({ ok: true, remaining: 1 - recentCount });
});

// OBSERVATION
app.post('/api/observation', async (req, res) => {
  const { task_id, tab, observation } = req.body, date = today();
  await sb.rpc('ck_upsert_checklist_entry', { p_task_id: task_id, p_date: date, p_tab: tab, p_observation: observation || null });
  res.json({ ok: true });
});

// FINALIZE
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

// BULLETIN
app.get('/api/bulletin', async (req, res) => {
  const { data } = await sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false });
  res.json(data || []);
});
app.post('/api/bulletin', async (req, res) => {
  const { title, message, priority, created_by } = req.body;
  await sb.from('ck_bulletin').insert({ title, message, created_by, created_at: nowTime(), date: today(), priority: priority || 'normal' });
  res.json({ ok: true });
});
app.put('/api/bulletin/:id', async (req, res) => {
  await sb.from('ck_bulletin').update({ title: req.body.title, message: req.body.message, priority: req.body.priority || 'normal' }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/bulletin/:id', async (req, res) => {
  await sb.from('ck_bulletin').update({ active: 0 }).eq('id', req.params.id);
  res.json({ ok: true });
});

// AUDIT LOG
app.get('/api/audit', async (req, res) => {
  const { data } = await sb.from('ck_audit_log').select('*').in('date', datesBack(parseInt(req.query.days) || 3)).order('id', { ascending: false }).limit(100);
  res.json(data || []);
});

// OCCURRENCES
app.get('/api/occurrences', async (req, res) => {
  const { data } = await sb.from('ck_occurrences').select('*').in('date', datesBack(parseInt(req.query.days) || 7)).order('id', { ascending: false });
  res.json(data || []);
});
app.post('/api/occurrences', async (req, res) => {
  await sb.from('ck_occurrences').insert({ text: req.body.text, category: req.body.category || 'geral', priority: req.body.priority || 'normal', created_by: req.body.created_by, created_at: nowTime(), date: today() });
  res.json({ ok: true });
});
app.post('/api/occurrences/:id/resolve', async (req, res) => {
  await sb.from('ck_occurrences').update({ resolved: 1, resolved_by: req.body.resolved_by, resolved_at: nowTime() }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/occurrences/:id', async (req, res) => {
  await sb.from('ck_occurrences').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard', async (req, res) => {
  const date = today(), d7 = datesBack(7);
  const { data: sectors } = await sb.from('ck_sectors').select('*').order('sort_order');
  const todayStats = {};
  for (const tab of ['abertura', 'fechamento']) {
    todayStats[tab] = [];
    for (const sc of (sectors || [])) {
      const { count: total } = await sb.from('ck_tasks').select('*', { count: 'exact', head: true }).eq('sector_id', sc.id).eq('tab', tab).eq('active', 1);
      const { data: taskIds } = await sb.from('ck_tasks').select('id').eq('sector_id', sc.id).eq('tab', tab).eq('active', 1);
      let done = 0;
      if (taskIds?.length) {
        const { count } = await sb.from('ck_checklist_entries').select('*', { count: 'exact', head: true }).in('task_id', taskIds.map(t => t.id)).eq('date', date).eq('tab', tab).eq('done', 1);
        done = count || 0;
      }
      const { data: fin } = await sb.from('ck_finalizations').select('*').eq('sector_id', sc.id).eq('date', date).eq('tab', tab).maybeSingle();
      todayStats[tab].push({ id: sc.id, name: sc.name, icon: sc.icon, total: total || 0, done, finalized: !!fin });
    }
  }
  const weeklyRates = [];
  for (const dt of d7) {
    let td = 0, ta = 0;
    for (const tab of ['abertura', 'fechamento']) {
      for (const s of (sectors || [])) {
        const { count: total } = await sb.from('ck_tasks').select('*', { count: 'exact', head: true }).eq('sector_id', s.id).eq('tab', tab).eq('active', 1);
        ta += total || 0;
        const { data: taskIds } = await sb.from('ck_tasks').select('id').eq('sector_id', s.id).eq('tab', tab).eq('active', 1);
        if (taskIds?.length) {
          const { count } = await sb.from('ck_checklist_entries').select('*', { count: 'exact', head: true }).in('task_id', taskIds.map(t => t.id)).eq('date', dt).eq('tab', tab).eq('done', 1);
          td += count || 0;
        }
      }
    }
    weeklyRates.push({ date: dt, pct: ta ? Math.round(td / ta * 100) : 0 });
  }
  const { count: presentToday } = await sb.from('ck_attendance').select('*', { count: 'exact', head: true }).eq('date', date);
  const { count: openOccurrences } = await sb.from('ck_occurrences').select('*', { count: 'exact', head: true }).eq('resolved', 0);
  const { data: tempAlertData } = await sb.from('ck_temperature_logs').select('id').eq('date', date).eq('alert', 1);
  const { data: expiryData } = await sb.from('ck_expiry_items').select('id,expiry_date').eq('replaced', 0);
  const expiringCount = (expiryData || []).filter(i => Math.ceil((new Date(i.expiry_date) - new Date(date)) / 86400000) <= 5).length;
  const { data: bulletins } = await sb.from('ck_bulletin').select('*').eq('active', 1).order('id', { ascending: false });
  res.json({ todayStats, weeklyRates, presentToday: presentToday || 0, openOccurrences: openOccurrences || 0, tempAlerts: (tempAlertData || []).length, expiringCount, bulletins: bulletins || [] });
});

// ALERTS
app.get('/api/alerts', async (req, res) => {
  const { data } = await sb.from('ck_admin_alerts').select('*').in('date', datesBack(3)).order('id', { ascending: false });
  res.json(data || []);
});
app.post('/api/alerts/seen', async (req, res) => {
  await sb.from('ck_admin_alerts').update({ seen: 1 }).eq('seen', 0);
  res.json({ ok: true });
});

// SETTINGS
app.get('/api/settings', async (req, res) => {
  const { data } = await sb.from('ck_settings').select('*');
  const obj = {}; (data || []).forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.post('/api/settings', async (req, res) => {
  await sb.rpc('ck_upsert_setting', { p_key: req.body.key, p_value: req.body.value });
  res.json({ ok: true });
});

// TEMPERATURE
app.get('/api/temperatures', async (req, res) => {
  const { data } = await sb.from('ck_temperature_logs').select('*').eq('date', req.query.date || today()).order('time', { ascending: false });
  res.json(data || []);
});
app.post('/api/temperatures', async (req, res) => {
  const { equipment, temperature, min_temp, max_temp, logged_by } = req.body;
  const temp = parseFloat(temperature), mn = parseFloat(min_temp) || -25, mx = parseFloat(max_temp) || -10;
  const alert = (temp < mn || temp > mx) ? 1 : 0;
  await sb.from('ck_temperature_logs').insert({ equipment, temperature: temp, min_temp: mn, max_temp: mx, date: today(), time: nowTime(), logged_by, alert });
  if (alert) await sb.from('ck_admin_alerts').insert({ type: 'temperature', message: `🌡️ ${equipment}: ${temp}°C fora da faixa`, user_name: logged_by, user_id: null, date: today(), time: nowTime() });
  res.json({ ok: true, alert });
});

// EXPIRY
app.get('/api/expiry', async (req, res) => {
  const { data: items } = await sb.from('ck_expiry_items').select('*').order('expiry_date');
  const t = today();
  res.json((items || []).map(i => {
    const dl = Math.ceil((new Date(i.expiry_date) - new Date(t)) / 86400000);
    let st = 'ok'; if (i.replaced) st = 'replaced'; else if (dl < 0) st = 'vencido'; else if (dl <= 3) st = 'critico'; else if (dl <= 5) st = 'atencao';
    return { ...i, daysLeft: dl, status: st };
  }));
});
app.post('/api/expiry', async (req, res) => {
  await sb.from('ck_expiry_items').insert({ name: req.body.name, category: req.body.category || 'geral', expiry_date: req.body.expiry_date, quantity: req.body.quantity || null, added_by: req.body.added_by, added_at: nowTime() });
  res.json({ ok: true });
});
app.put('/api/expiry/:id', async (req, res) => {
  if (req.body.update_date_only) await sb.from('ck_expiry_items').update({ expiry_date: req.body.expiry_date, replaced: 0, replaced_by: null, replaced_at: null, new_expiry_date: null }).eq('id', req.params.id);
  else await sb.from('ck_expiry_items').update({ name: req.body.name, category: req.body.category, expiry_date: req.body.expiry_date, quantity: req.body.quantity || null }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.post('/api/expiry/:id/replace', async (req, res) => {
  await sb.from('ck_expiry_items').update({ replaced: 1, replaced_by: req.body.replaced_by, replaced_at: nowTime(), new_expiry_date: req.body.new_expiry_date || null }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.post('/api/expiry/:id/unreplace', async (req, res) => {
  const { data: it } = await sb.from('ck_expiry_items').select('*').eq('id', req.params.id).single();
  if (it?.new_expiry_date) await sb.from('ck_expiry_items').update({ replaced: 0, replaced_by: null, replaced_at: null, expiry_date: it.new_expiry_date, new_expiry_date: null }).eq('id', req.params.id);
  else await sb.from('ck_expiry_items').update({ replaced: 0, replaced_by: null, replaced_at: null }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/expiry/:id', async (req, res) => {
  await sb.from('ck_expiry_items').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

// ATTENDANCE
app.get('/api/attendance', async (req, res) => {
  const { data } = await sb.from('ck_attendance').select('*').in('date', datesBack(parseInt(req.query.days) || 7)).order('date', { ascending: false }).order('check_in');
  res.json(data || []);
});
app.get('/api/attendance/today', async (req, res) => {
  const { data } = await sb.from('ck_attendance').select('*').eq('date', today()).order('check_in');
  res.json(data || []);
});

// SHIFTS
app.get('/api/shifts', async (req, res) => {
  const { data: shifts } = await sb.from('ck_shifts').select('*');
  const result = [];
  for (const s of (shifts || [])) {
    const { data: u } = await sb.from('ck_users').select('name').eq('id', s.user_id).eq('active', 1).maybeSingle();
    const { data: sec } = await sb.from('ck_sectors').select('name,icon').eq('id', s.sector_id).maybeSingle();
    if (u && sec) result.push({ ...s, user_name: u.name, sector_name: sec.name, sector_icon: sec.icon });
  }
  res.json(result);
});
app.post('/api/shifts/bulk', async (req, res) => {
  const { user_id, assignments } = req.body;
  await sb.from('ck_shifts').delete().eq('user_id', user_id);
  if (assignments?.length) await sb.from('ck_shifts').insert(assignments.map(a => ({ user_id, sector_id: a.sector_id, day_of_week: a.day_of_week })));
  res.json({ ok: true });
});

// RANKING
app.get('/api/ranking', async (req, res) => {
  const dates = datesBack(parseInt(req.query.days) || 7);
  const { data: rvRow } = await sb.from('ck_settings').select('value').eq('key', 'ranking_visible').maybeSingle();
  const rv = rvRow?.value === '1';
  const { data: entries } = await sb.from('ck_checklist_entries').select('done_by').eq('done', 1).in('date', dates).not('done_by', 'is', null);
  const taskMap = {}; (entries || []).forEach(e => { taskMap[e.done_by] = (taskMap[e.done_by] || 0) + 1; });
  const taskRanking = Object.entries(taskMap).map(([name, tasks_done]) => ({ name, tasks_done })).sort((a, b) => b.tasks_done - a.tasks_done);
  const { data: att } = await sb.from('ck_attendance').select('user_name').in('date', dates);
  const attMap = {}; (att || []).forEach(a => { attMap[a.user_name] = (attMap[a.user_name] || 0) + 1; });
  const attendanceRanking = Object.entries(attMap).map(([name, days_present]) => ({ name, days_present })).sort((a, b) => b.days_present - a.days_present);
  const { data: fins } = await sb.from('ck_finalizations').select('finalized_by').in('date', dates);
  const finMap = {}; (fins || []).forEach(f => { finMap[f.finalized_by] = (finMap[f.finalized_by] || 0) + 1; });
  const finalizationRanking = Object.entries(finMap).map(([name, sectors_finalized]) => ({ name, sectors_finalized })).sort((a, b) => b.sectors_finalized - a.sectors_finalized);
  const { data: eb } = await sb.from('ck_attendance').select('user_name,check_in').in('date', dates);
  const ebMap = {}; (eb || []).forEach(e => { if (!ebMap[e.user_name] || e.check_in < ebMap[e.user_name]) ebMap[e.user_name] = e.check_in; });
  const earlyBird = Object.entries(ebMap).map(([name, earliest]) => ({ name, earliest })).sort((a, b) => a.earliest.localeCompare(b.earliest));
  res.json({ rankingVisible: rv, taskRanking, attendanceRanking, finalizationRanking, earlyBird, period: dates.length });
});

// REPORTS
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
        if (taskIds?.length) {
          const { count } = await sb.from('ck_checklist_entries').select('*', { count: 'exact', head: true }).in('task_id', taskIds.map(t => t.id)).eq('date', date).eq('tab', tab).eq('done', 1);
          done = count || 0;
        }
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
    for (const t of (tasks || [])) {
      const { data: e } = await sb.from('ck_checklist_entries').select('*').eq('task_id', t.id).eq('date', date).eq('tab', tab).maybeSingle();
      items.push({ text: t.text, critical: !!t.critical, done: e ? !!e.done : false, done_by: e?.done_by || null, done_at: e?.done_at || null, observation: e?.observation || null });
    }
    const { data: fin } = await sb.from('ck_finalizations').select('*').eq('sector_id', s.id).eq('date', date).eq('tab', tab).maybeSingle();
    result.push({ ...s, items, finalized: !!fin, finalizedBy: fin?.finalized_by || null, finalizedAt: fin?.finalized_at || null });
  }
  res.json(result);
});
app.get('/api/export/pdf', (req, res) => { res.redirect(`/api/reports/${req.query.date || today()}/abertura`); });

// ===================== ADMIN =====================
app.get('/api/users', async (req, res) => {
  const { data } = await sb.from('ck_users').select('id,username,name,role,sector,active').order('name');
  res.json(data || []);
});
app.post('/api/users', async (req, res) => {
  const { error } = await sb.from('ck_users').insert({ username: req.body.username.toLowerCase(), password: req.body.password, name: req.body.name, role: req.body.role || 'operador', sector: req.body.sector || null });
  if (error) return res.status(400).json({ error: 'Usuário já existe' });
  res.json({ ok: true });
});
app.put('/api/users/:id', async (req, res) => {
  const updates = {};
  ['name', 'role', 'sector', 'password', 'active'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada' });
  await sb.from('ck_users').update(updates).eq('id', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/users/:id', async (req, res) => {
  await sb.from('ck_users').delete().eq('id', req.params.id);
  res.json({ ok: true });
});
app.get('/api/tasks', async (req, res) => {
  const { data } = await sb.from('ck_tasks').select('*').eq('active', 1).order('tab').order('sector_id').order('sort_order');
  res.json(data || []);
});
app.post('/api/tasks', async (req, res) => {
  const { data: maxRow } = await sb.from('ck_tasks').select('sort_order').eq('sector_id', req.body.sector_id).eq('tab', req.body.tab).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  await sb.from('ck_tasks').insert({ sector_id: req.body.sector_id, tab: req.body.tab, text: req.body.text, note: req.body.note || null, sort_order: (maxRow?.sort_order || 0) + 1, critical: req.body.critical ? 1 : 0 });
  res.json({ ok: true });
});
app.put('/api/tasks/:id', async (req, res) => {
  await sb.from('ck_tasks').update({ text: req.body.text, note: req.body.note || null, critical: req.body.critical ? 1 : 0 }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/tasks/:id', async (req, res) => {
  await sb.from('ck_tasks').update({ active: 0 }).eq('id', req.params.id);
  res.json({ ok: true });
});
app.post('/api/reset-day', async (req, res) => {
  const d = today();
  await sb.from('ck_checklist_entries').delete().eq('date', d);
  await sb.from('ck_finalizations').delete().eq('date', d);
  await sb.from('ck_temperature_logs').delete().eq('date', d);
  res.json({ ok: true });
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

seed().then(() => {
  app.listen(PORT, () => console.log(`Toca do Coelho rodando na porta ${PORT} (Supabase)`));
}).catch(e => {
  console.error('Erro no seed:', e);
  app.listen(PORT, () => console.log(`Toca do Coelho rodando na porta ${PORT} (seed falhou)`));
});
