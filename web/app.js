const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
let user = null;
let authReady = false;
let savingsGoal = null;
let transactions = [];
let subscriptions = [];

// ========== UTILITÁRIOS ==========

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function money(n) {
    return (Number(n) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(s) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, isError = false) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), 3000);
}

// Lança o erro do Supabase para ser apanhado pelo try/catch de quem chama
function check({ data, error }) {
    if (error) throw error;
    return data;
}

function monthRange() {
    const [y, m] = $('month-picker').value.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${last}` };
}

function formToObject(form) {
    const o = Object.fromEntries(new FormData(form));
    for (const k in o) if (o[k] === '') o[k] = null;
    return o;
}

// ========== AUTENTICAÇÃO ==========

$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({
        email: $('login-email').value.trim(),
        options: { emailRedirectTo: location.origin + location.pathname }
    });
    btn.disabled = false;
    $('login-msg').textContent = error
        ? 'Erro: ' + error.message
        : '📬 Verifique o seu email e clique no link para entrar.';
});

$('logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
    const newUser = session?.user ?? null;
    if (authReady && newUser?.id === user?.id) return; // ex.: renovação do token
    authReady = true;
    user = newUser;
    $('login-view').classList.toggle('hidden', !!user);
    $('app-view').classList.toggle('hidden', !user);
    if (user) {
        $('user-email').textContent = user.email;
        // fora do callback: chamadas ao Supabase dentro dele podem bloquear
        setTimeout(loadAll, 0);
    }
});

// ========== CARREGAMENTO ==========

async function loadAll() {
    try {
        await sb.rpc('process_subscriptions').then(check);
        await Promise.all([loadSettings(), loadBalance(), loadSubscriptions()]);
        await loadMonth();
    } catch (err) {
        toast('Erro ao carregar: ' + err.message, true);
    }
}

async function loadBalance() {
    const balance = Number(check(await sb.rpc('get_balance')));
    $('balance').textContent = money(balance);
    $('balance').closest('.balance-box').classList.toggle('negative', balance < 0);
}

async function loadSettings() {
    const row = check(await sb.from('settings').select('meta_poupanca').maybeSingle());
    savingsGoal = row?.meta_poupanca != null ? Number(row.meta_poupanca) : null;
    $('savings-goal').value = savingsGoal ?? '';
}

async function loadMonth() {
    const { from, to } = monthRange();
    transactions = check(await sb.from('transactions').select('*')
        .gte('data', from).lte('data', to)
        .order('data', { ascending: false }).order('id', { ascending: false }));
    renderTransactions();
    renderSummary();
    renderCategoryChart();
    await Promise.all([loadTrend(), loadCategories()]);
}

// Ganhos vs gastos dos 6 meses até ao mês selecionado
async function loadTrend() {
    const [y, m] = $('month-picker').value.split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    }
    const rows = check(await sb.rpc('monthly_totals', { desde: months[0] }));
    const byMonth = Object.fromEntries(rows.map(r => [r.mes, r]));
    const data = months.map(mes => ({
        mes,
        ganhos: Number(byMonth[mes]?.ganhos || 0),
        gastos: Number(byMonth[mes]?.gastos || 0)
    }));
    const max = Math.max(1, ...data.flatMap(d => [d.ganhos, d.gastos]));
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    $('trend-chart').innerHTML = data.map(d => `
        <div class="trend-col" title="${nomes[Number(d.mes.slice(5, 7)) - 1]}: +${money(d.ganhos)} € / −${money(d.gastos)} €">
            <div class="trend-bars">
                <span class="bar ganho" style="height:${(d.ganhos / max) * 100}%"></span>
                <span class="bar gasto" style="height:${(d.gastos / max) * 100}%"></span>
            </div>
            <small>${nomes[Number(d.mes.slice(5, 7)) - 1]}</small>
        </div>`).join('');
}

function renderCategoryChart() {
    const totals = {};
    for (const t of transactions) {
        if (t.tipo !== 'gasto') continue;
        const c = t.categoria || 'Sem categoria';
        totals[c] = (totals[c] || 0) + Number(t.valor);
    }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
        $('cat-chart').innerHTML = '<p class="empty">Sem gastos neste mês.</p>';
        return;
    }
    const total = entries.reduce((a, [, v]) => a + v, 0);
    $('cat-chart').innerHTML = entries.slice(0, 8).map(([cat, v]) => `
        <div class="bar-row">
            <span class="bar-label">${escapeHTML(cat)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(v / entries[0][1]) * 100}%"></span></span>
            <span class="bar-value">${money(v)} € <small class="muted">${Math.round((v / total) * 100)}%</small></span>
        </div>`).join('');
}

async function loadSubscriptions() {
    subscriptions = check(await sb.from('subscriptions').select('*').order('data_proximo_pagamento'));
    renderSubscriptions();
}

async function loadCategories() {
    const rows = check(await sb.from('transactions').select('categoria').not('categoria', 'is', null).limit(500));
    const cats = [...new Set(rows.map(r => r.categoria))].sort();
    $('categorias').innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">`).join('');
}

// ========== RENDER ==========

function renderSummary() {
    const { from, to } = monthRange();
    const ganhos = transactions.filter(t => t.tipo === 'ganho').reduce((a, t) => a + Number(t.valor), 0);
    const gastos = transactions.filter(t => t.tipo === 'gasto').reduce((a, t) => a + Number(t.valor), 0);
    // subscrições ainda por cobrar neste mês
    const porVencer = (tipo) => subscriptions
        .filter(s => s.ativo && (s.tipo || 'gasto') === tipo && s.data_proximo_pagamento >= from && s.data_proximo_pagamento <= to)
        .reduce((a, s) => a + Number(s.valor), 0);
    const ganhosPrevistos = ganhos + porVencer('ganho');
    const gastosPrevistos = gastos + porVencer('gasto');
    const livre = ganhosPrevistos - gastosPrevistos - (savingsGoal || 0);

    $('m-ganhos').textContent = money(ganhosPrevistos) + ' €';
    $('m-gastos').textContent = money(gastosPrevistos) + ' €';
    $('m-livre-label').textContent = savingsGoal ? `Pode gastar (meta ${money(savingsGoal)} €)` : 'Disponível';
    $('m-livre').textContent = money(livre) + ' €';
    $('m-livre').classList.toggle('neg', livre < 0);
}

function renderTransactions() {
    const body = $('tx-body');
    const q = $('tx-search').value.trim().toLowerCase();
    const tipo = $('tx-filter').value;
    const visible = transactions.filter(t =>
        (!tipo || t.tipo === tipo) &&
        (!q || t.descricao.toLowerCase().includes(q) || (t.categoria || '').toLowerCase().includes(q)));
    if (!visible.length) {
        body.innerHTML = `<tr><td colspan="5" class="empty">${transactions.length ? 'Nada corresponde ao filtro.' : 'Sem movimentos neste mês.'}</td></tr>`;
        return;
    }
    body.innerHTML = visible.map(t => `
        <tr>
            <td>${formatDate(t.data)}</td>
            <td>${escapeHTML(t.descricao)}</td>
            <td>${escapeHTML(t.categoria || '-')}</td>
            <td class="num ${t.tipo}">${t.tipo === 'ganho' ? '+' : '−'}${money(t.valor)} €</td>
            <td class="actions">
                <button class="icon" data-edit-tx="${t.id}" aria-label="Editar">✏️</button>
                <button class="icon" data-del-tx="${t.id}" aria-label="Eliminar">🗑️</button>
            </td>
        </tr>`).join('');
}

function renderSubscriptions() {
    const list = $('subs-list');
    if (!subscriptions.length) {
        list.innerHTML = '<p class="empty">Nenhum recorrente. Adicione subscrições, renda ou o salário.</p>';
        return;
    }
    list.innerHTML = subscriptions.map(s => `
        <div class="item ${s.ativo ? '' : 'inactive'}">
            <span>
                <strong>${escapeHTML(s.nome)}</strong> · <span class="${s.tipo || 'gasto'}">${s.tipo === 'ganho' ? '+' : '−'}${money(s.valor)} €</span> (${s.frequencia})<br>
                <small class="muted">${s.ativo ? 'Próximo: ' + formatDate(s.data_proximo_pagamento) : 'Inativa'}</small>
            </span>
            <span>
                <button class="icon" data-edit-sub="${s.id}" aria-label="Editar">✏️</button>
                <button class="icon" data-del-sub="${s.id}" aria-label="Eliminar">🗑️</button>
            </span>
        </div>`).join('');
}

// ========== AÇÕES ==========

$('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
        check(await sb.from('transactions').insert(formToObject(form)));
        const tipo = form.tipo.value;
        form.reset();
        form.tipo.value = tipo;
        form.data.value = todayStr();
        toast('Movimento adicionado');
        await Promise.all([loadMonth(), loadBalance()]);
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});

$('set-savings').addEventListener('click', async () => {
    const v = $('savings-goal').value;
    try {
        check(await sb.from('settings').upsert({ user_id: user.id, meta_poupanca: v === '' ? null : Number(v) }));
        savingsGoal = v === '' ? null : Number(v);
        renderSummary();
        toast('Meta guardada');
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});

// Delegação de cliques nas listas (editar/eliminar)
document.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
        if (b.dataset.editTx) {
            const t = transactions.find(x => x.id == b.dataset.editTx);
            fillForm($('tx-edit-form'), t);
            $('tx-modal').showModal();
        } else if (b.dataset.delTx) {
            if (!confirm('Eliminar este movimento?')) return;
            check(await sb.from('transactions').delete().eq('id', b.dataset.delTx));
            await Promise.all([loadMonth(), loadBalance()]);
        } else if (b.dataset.editSub) {
            const s = subscriptions.find(x => x.id == b.dataset.editSub);
            openSubModal(s);
        } else if (b.dataset.delSub) {
            if (!confirm('Eliminar este recorrente? Os movimentos já lançados mantêm-se.')) return;
            check(await sb.from('subscriptions').delete().eq('id', b.dataset.delSub));
            await loadSubscriptions();
            renderSummary();
        } else if (b.hasAttribute('data-close')) {
            b.closest('dialog').close();
        }
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});

function fillForm(form, obj) {
    for (const el of form.elements) {
        if (!el.name || !(el.name in obj)) continue;
        if (el.type === 'checkbox') el.checked = !!obj[el.name];
        else el.value = obj[el.name] ?? '';
    }
}

$('tx-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { id, ...fields } = formToObject(e.target);
    try {
        check(await sb.from('transactions').update(fields).eq('id', id));
        $('tx-modal').close();
        await Promise.all([loadMonth(), loadBalance()]);
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});

function openSubModal(sub) {
    const form = $('sub-form');
    form.reset();
    form.id.value = '';
    form.data_proximo_pagamento.value = todayStr();
    if (sub) fillForm(form, sub);
    $('sub-title').textContent = sub ? 'Editar recorrente' : 'Novo recorrente';
    $('sub-modal').showModal();
}

$('add-sub').addEventListener('click', () => openSubModal(null));

$('sub-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { id, ...fields } = formToObject(e.target);
    fields.ativo = e.target.ativo.checked;
    try {
        if (id) check(await sb.from('subscriptions').update(fields).eq('id', id));
        else check(await sb.from('subscriptions').insert(fields));
        $('sub-modal').close();
        await loadAll(); // pode haver cobranças novas se a data já passou
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});

// ========== NAVEGAÇÃO POR MÊS ==========

function shiftMonth(delta) {
    const [y, m] = $('month-picker').value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    $('month-picker').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    loadMonth().catch(err => toast('Erro: ' + err.message, true));
}

$('prev-month').addEventListener('click', () => shiftMonth(-1));
$('next-month').addEventListener('click', () => shiftMonth(1));
$('month-picker').addEventListener('change', () => shiftMonth(0));

$('month-picker').value = todayStr().slice(0, 7);
$('tx-form').data.value = todayStr();

$('tx-search').addEventListener('input', renderTransactions);
$('tx-filter').addEventListener('change', renderTransactions);

// ========== EXPORTAR / CONTA ==========

$('export-csv').addEventListener('click', async () => {
    try {
        // a API devolve no máximo 1000 linhas por pedido: paginar
        const all = [];
        for (let from = 0; ; from += 1000) {
            const page = check(await sb.from('transactions')
                .select('data, tipo, descricao, categoria, valor')
                .order('data').order('id').range(from, from + 999));
            all.push(...page);
            if (page.length < 1000) break;
        }
        const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = ['Data;Tipo;Descrição;Categoria;Valor']
            .concat(all.map(t => [t.data, t.tipo, t.descricao, t.categoria, String(t.valor).replace('.', ',')].map(cell).join(';')))
            .join('\r\n');
        // BOM para o Excel abrir os acentos corretamente
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `despesas-${todayStr()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (err) {
        toast('Erro ao exportar: ' + err.message, true);
    }
});

$('delete-account').addEventListener('click', async () => {
    const typed = prompt(`Isto apaga a conta e TODOS os dados, sem volta.\nPara confirmar, escreva o seu email (${user.email}):`);
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== user.email.toLowerCase()) return toast('Email não corresponde. Nada foi apagado.', true);
    try {
        check(await sb.rpc('delete_account'));
        await sb.auth.signOut();
        toast('Conta apagada.');
    } catch (err) {
        toast('Erro: ' + err.message, true);
    }
});
