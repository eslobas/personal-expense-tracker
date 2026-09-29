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
    const rows = check(await sb.from('transactions').select('tipo, valor'));
    const balance = rows.reduce((acc, t) => acc + (t.tipo === 'ganho' ? 1 : -1) * Number(t.valor), 0);
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
    loadCategories();
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
    const porVencer = subscriptions
        .filter(s => s.ativo && s.data_proximo_pagamento >= from && s.data_proximo_pagamento <= to)
        .reduce((a, s) => a + Number(s.valor), 0);
    const gastosPrevistos = gastos + porVencer;
    const livre = ganhos - gastosPrevistos - (savingsGoal || 0);

    $('m-ganhos').textContent = money(ganhos) + ' €';
    $('m-gastos').textContent = money(gastosPrevistos) + ' €';
    $('m-livre-label').textContent = savingsGoal ? `Pode gastar (meta ${money(savingsGoal)} €)` : 'Disponível';
    $('m-livre').textContent = money(livre) + ' €';
    $('m-livre').classList.toggle('neg', livre < 0);
}

function renderTransactions() {
    const body = $('tx-body');
    if (!transactions.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">Sem movimentos neste mês.</td></tr>';
        return;
    }
    body.innerHTML = transactions.map(t => `
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
        list.innerHTML = '<p class="empty">Nenhuma subscrição.</p>';
        return;
    }
    list.innerHTML = subscriptions.map(s => `
        <div class="item ${s.ativo ? '' : 'inactive'}">
            <span>
                <strong>${escapeHTML(s.nome)}</strong> · ${money(s.valor)} € (${s.frequencia})<br>
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
            if (!confirm('Eliminar esta subscrição? Os gastos já lançados mantêm-se.')) return;
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
    $('sub-title').textContent = sub ? 'Editar subscrição' : 'Nova subscrição';
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
