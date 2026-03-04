// Configurações
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let savingsGoal = null;

// Elementos DOM
const mainContent = document.getElementById('main-content');
const monthCheckSection = document.getElementById('month-check-section');
const balanceSpan = document.getElementById('current-balance');
const monthPicker = document.getElementById('month-picker');
const loadMonthBtn = document.getElementById('load-month');
const savingsGoalInput = document.getElementById('savings-goal');
const setSavingsBtn = document.getElementById('set-savings');
const savingsInfo = document.getElementById('savings-info');
const budgetInfo = document.getElementById('budget-info');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('A iniciar aplicação...');
    init();
});

async function init() {
    try {
        // Configurar mês atual no picker
        const today = new Date();
        currentMonth = today.getMonth() + 1;
        currentYear = today.getFullYear();
        monthPicker.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        
        // Mostrar conteúdo principal diretamente (sem verificação de saldo inicial)
        mainContent.classList.remove('hidden');
        
        // Carregar todos os dados
        await loadAllData();
        await checkMonthChange();
        
        // Configurar event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao carregar a aplicação. Verifique o console (F12).');
    }
}

function setupEventListeners() {
    // Botões principais
    document.getElementById('salary-yes')?.addEventListener('click', () => recordSalary(true));
    document.getElementById('salary-no')?.addEventListener('click', () => recordSalary(false));
    document.getElementById('gain-form')?.addEventListener('submit', (e) => addTransaction(e, 'ganho'));
    document.getElementById('expense-form')?.addEventListener('submit', (e) => addTransaction(e, 'gasto'));
    document.getElementById('set-savings')?.addEventListener('click', setSavingsGoal);
    document.getElementById('load-month')?.addEventListener('click', loadMonthData);
    document.getElementById('update-physical-cash')?.addEventListener('click', updatePhysicalCash);
    document.getElementById('show-add-subscription')?.addEventListener('click', showAddSubscription);
    document.getElementById('subscription-form')?.addEventListener('submit', saveSubscription);
    document.getElementById('show-add-investment')?.addEventListener('click', showAddInvestment);
    document.getElementById('investment-form')?.addEventListener('submit', saveInvestment);
    document.getElementById('inv-tipo')?.addEventListener('change', toggleInvestmentFrequency);
    document.getElementById('edit-form')?.addEventListener('submit', saveEdit);
    
    // Tabs
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Modais - fechar
    document.querySelectorAll('.modal .close').forEach(span => {
        span.addEventListener('click', function() {
            this.closest('.modal').classList.add('hidden');
        });
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });
}

// ========== FUNÇÕES PRINCIPAIS ==========

async function loadAllData() {
    console.log('A carregar todos os dados...');
    try {
        // Processar subscrições primeiro
        await processSubscriptions();
        
        // Carregar dados em paralelo
        await Promise.all([
            updateBalance(),
            loadSettings(),
            loadPhysicalCash(),
            loadSubscriptions(),
            loadInvestments(),
            loadMonthData()
        ]);
        
        console.log('Todos os dados carregados com sucesso!');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ========== API CALLS ==========

async function fetchAPI(url, options = {}) {
    console.log(`🌐 Fetching ${url}...`, options);
    try {
        const res = await fetch(url, options);
        console.log(`📥 Resposta de ${url}: status ${res.status}`);
        
        const text = await res.text();
        console.log(`📄 Texto resposta:`, text.substring(0, 200)); // primeiros 200 caracteres
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('❌ Resposta não é JSON válido:', text);
            throw new Error('Resposta do servidor não é JSON válido');
        }
    } catch (error) {
        console.error(`❌ Erro em fetchAPI para ${url}:`, error);
        throw error;
    }
}
// ========== SALDO ==========

async function updateBalance() {
    try {
        const data = await fetchAPI('/api/balance');
        balanceSpan.textContent = data.balance.toFixed(2).replace('.', ',');
    } catch (error) {
        console.error('Erro ao atualizar saldo:', error);
        balanceSpan.textContent = '0,00';
    }
}

// ========== META POUPANÇA ==========

async function loadSettings() {
    try {
        const data = await fetchAPI('/api/settings/meta_poupanca');
        console.log('Meta carregada:', data);
        
        if (data.value) {
            savingsGoal = parseFloat(data.value);
            savingsGoalInput.value = savingsGoal;
            savingsInfo.textContent = `Meta definida: ${savingsGoal.toFixed(2).replace('.', ',')} €`;
        } else {
            savingsGoal = null;
            savingsGoalInput.value = '';
            savingsInfo.textContent = 'Nenhuma meta definida.';
        }
        await calculateBudget();
    } catch (error) {
        console.error('Erro ao carregar settings:', error);
    }
}

async function setSavingsGoal() {
    const value = savingsGoalInput.value;
    console.log('A definir meta:', value);
    
    try {
        if (value === '') {
            await fetchAPI('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'meta_poupanca', value: null })
            });
            savingsGoal = null;
            savingsInfo.textContent = 'Nenhuma meta definida.';
        } else {
            const num = parseFloat(value.replace(',', '.'));
            if (num < 0) return alert('Valor inválido');
            
            await fetchAPI('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'meta_poupanca', value: num })
            });
            savingsGoal = num;
            savingsInfo.textContent = `Meta definida: ${num.toFixed(2).replace('.', ',')} €`;
        }
        await calculateBudget();
    } catch (error) {
        console.error('Erro ao guardar meta:', error);
        alert('Erro ao guardar meta');
    }
}

async function calculateBudget() {
    console.log('A calcular orçamento...');
    console.log('Mês atual:', currentMonth, 'Ano:', currentYear);
    console.log('Meta de poupança:', savingsGoal);
    
    try {
        // Buscar totais do mês
        const url = `/api/monthly-totals?mes=${currentMonth}&ano=${currentYear}`;
        console.log('A buscar totais em:', url);
        
        const totals = await fetchAPI(url);
        console.log('Totais recebidos:', totals);
        
        // Garantir que são números
        const ganhos = parseFloat(totals.ganhos) || 0;
        const gastos = parseFloat(totals.gastos) || 0;
        console.log('Ganhos (convertido):', ganhos, 'Gastos (convertido):', gastos);
        
        // Buscar subscrições futuras
        const upcomingUrl = `/api/subscriptions/upcoming?mes=${currentMonth}&ano=${currentYear}`;
        console.log('A buscar subscrições futuras em:', upcomingUrl);
        
        const upcomingSubs = await fetchAPI(upcomingUrl);
        console.log('Subscrições futuras:', upcomingSubs);
        
        // Garantir que upcomingSubs é um array
        const subsArray = Array.isArray(upcomingSubs) ? upcomingSubs : [];
        const totalSubsFuturas = subsArray.reduce((acc, s) => {
            return acc + (parseFloat(s.valor) || 0);
        }, 0);
        console.log('Total subscrições futuras:', totalSubsFuturas);
        
        const gastosPrevistos = gastos + totalSubsFuturas;
        console.log('Gastos previstos (reais + futuros):', gastosPrevistos);
        
        // Verificar se ganhos é um número válido antes de usar toFixed
        if (isNaN(ganhos)) {
            console.error('ganhos não é um número:', ganhos);
            throw new Error('Valor de ganhos inválido');
        }
        
        // Mostrar resultado
        if (!savingsGoal) {
            const disponivel = ganhos - gastosPrevistos;
            console.log('Sem meta - disponível:', disponivel);
            
            budgetInfo.innerHTML = `💰 <strong>Resumo do mês:</strong><br>
                Ganhos: ${ganhos.toFixed(2).replace('.', ',')} €<br>
                Gastos (reais + subscrições futuras): ${gastosPrevistos.toFixed(2).replace('.', ',')} €<br>
                <strong>Saldo disponível: ${disponivel.toFixed(2).replace('.', ',')} €</strong>`;
        } else {
            const disponivel = ganhos - gastosPrevistos - savingsGoal;
            console.log('Com meta - disponível:', disponivel);
            
            budgetInfo.innerHTML = `🎯 <strong>Com meta de poupança de ${savingsGoal.toFixed(2).replace('.', ',')} €:</strong><br>
                Ganhos: ${ganhos.toFixed(2).replace('.', ',')} €<br>
                Gastos (reais + subscrições futuras): ${gastosPrevistos.toFixed(2).replace('.', ',')} €<br>
                <strong>Pode gastar mais: ${disponivel.toFixed(2).replace('.', ',')} €</strong>`;
            
            if (disponivel < 0) {
                budgetInfo.innerHTML += '<br><span style="color:red">⚠️ Já ultrapassou o limite em ' + 
                    Math.abs(disponivel).toFixed(2).replace('.', ',') + ' €!</span>';
            }
        }
    } catch (error) {
        console.error('ERRO DETALHADO no calculateBudget:', error);
        console.error('Stack trace:', error.stack);
        budgetInfo.innerHTML = 'Erro ao calcular orçamento: ' + error.message;
    }
}

// ========== VERIFICAÇÃO MENSAL ==========

async function checkMonthChange() {
    try {
        const data = await fetchAPI('/api/settings/ultimo_mes_verificado');
        const lastChecked = data.value;
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        
        if (lastChecked !== currentMonthStr) {
            monthCheckSection.classList.remove('hidden');
        } else {
            monthCheckSection.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao verificar mês:', error);
    }
}

async function recordSalary(received) {
    try {
        if (received) {
            await fetchAPI('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'ganho',
                    descricao: 'Salário',
                    valor: 400,
                    data: new Date().toISOString().split('T')[0],
                    categoria: 'Salário'
                })
            });
        }
        
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        
        await fetchAPI('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ultimo_mes_verificado', value: currentMonthStr })
        });
        
        monthCheckSection.classList.add('hidden');
        await loadAllData();
        
    } catch (error) {
        console.error('Erro ao registar salário:', error);
        alert('Erro ao registar salário');
    }
}

// ========== MÊS E TRANSAÇÕES ==========

async function loadMonthData() {
    const [year, month] = monthPicker.value.split('-').map(Number);
    currentYear = year;
    currentMonth = month;
    await Promise.all([
        loadTransactions('gasto'),
        loadTransactions('ganho')
    ]);
    await calculateBudget();
}

async function loadTransactions(tipo) {
    try {
        const transactions = await fetchAPI(`/api/transactions?tipo=${tipo}&mes=${currentMonth}&ano=${currentYear}`);
        const tableBody = document.getElementById(tipo === 'gasto' ? 'expenses-table' : 'gains-table').querySelector('tbody');
        tableBody.innerHTML = '';
        
        if (transactions.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = `Nenhum ${tipo} encontrado.`;
            cell.style.textAlign = 'center';
            return;
        }
        
        transactions.forEach(t => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${formatDate(t.data)}</td>
                <td>${t.descricao}</td>
                <td>${t.categoria || '-'}</td>
                <td>${parseFloat(t.valor).toFixed(2).replace('.', ',')} €</td>
                <td class="actions">
                    <button onclick="editTransaction(${t.id})">✏️</button>
                    <button class="danger" onclick="deleteTransaction(${t.id})">🗑️</button>
                </td>
            `;
        });
    } catch (error) {
        console.error(`Erro ao carregar ${tipo}:`, error);
    }
}

async function addTransaction(event, tipo) {
    event.preventDefault();
    console.log('A adicionar transação do tipo:', tipo);
    
    const form = event.target;
    const formData = new FormData(form);
    
    const descricao = formData.get('descricao');
    const valorRaw = formData.get('valor');
    const data = formData.get('data');
    const categoria = formData.get('categoria');
    
    if (!descricao || !valorRaw || !data) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }
    
    const valorNumerico = parseFloat(valorRaw.replace(',', '.'));
    
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
        alert('Valor inválido');
        return;
    }
    
    try {
        await fetchAPI('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo,
                descricao,
                valor: valorNumerico,
                data,
                categoria: categoria || null
            })
        });
        
        form.reset();
        await loadAllData();
        
    } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        alert('Erro ao adicionar transação: ' + error.message);
    }
}

window.editTransaction = async (id) => {
    try {
        const t = await fetchAPI(`/api/transactions/${id}`);
        document.getElementById('edit-id').value = t.id;
        document.getElementById('edit-tipo').value = t.tipo;
        document.getElementById('edit-descricao').value = t.descricao;
        document.getElementById('edit-valor').value = t.valor;
        document.getElementById('edit-data').value = t.data.split('T')[0];
        document.getElementById('edit-categoria').value = t.categoria || '';
        document.getElementById('modal-title').textContent = `Editar ${t.tipo === 'ganho' ? 'Ganho' : 'Gasto'}`;
        document.getElementById('edit-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao carregar transação:', error);
        alert('Erro ao carregar transação');
    }
};

async function saveEdit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    try {
        await fetchAPI(`/api/transactions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                descricao: document.getElementById('edit-descricao').value,
                valor: parseFloat(document.getElementById('edit-valor').value.replace(',', '.')),
                data: document.getElementById('edit-data').value,
                categoria: document.getElementById('edit-categoria').value || null
            })
        });
        
        document.getElementById('edit-modal').classList.add('hidden');
        await loadAllData();
        
    } catch (error) {
        console.error('Erro ao guardar alterações:', error);
        alert('Erro ao guardar alterações');
    }
}

window.deleteTransaction = async (id) => {
    if (!confirm('Tem certeza que deseja eliminar esta transação?')) return;
    
    try {
        await fetchAPI(`/api/transactions/${id}`, { method: 'DELETE' });
        await loadAllData();
    } catch (error) {
        console.error('Erro ao eliminar transação:', error);
        alert('Erro ao eliminar transação');
    }
};

// ========== DINHEIRO FÍSICO ==========

async function loadPhysicalCash() {
    try {
        const data = await fetchAPI('/api/physical-cash');
        document.getElementById('physical-cash').value = data.valor.toFixed(2).replace('.', ',');
        document.getElementById('physical-cash-display').textContent = `💰 Dinheiro físico: ${data.valor.toFixed(2).replace('.', ',')} €`;
    } catch (error) {
        console.error('Erro ao carregar dinheiro físico:', error);
    }
}

async function updatePhysicalCash() {
    const valor = parseFloat(document.getElementById('physical-cash').value.replace(',', '.'));
    if (isNaN(valor)) return alert('Valor inválido');
    
    try {
        await fetchAPI('/api/physical-cash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor })
        });
        await loadPhysicalCash();
    } catch (error) {
        console.error('Erro ao atualizar dinheiro físico:', error);
        alert('Erro ao atualizar dinheiro físico');
    }
}

// ========== SUBSCRIÇÕES ==========

function showAddSubscription() {
    document.getElementById('subscription-modal-title').textContent = 'Nova Subscrição';
    document.getElementById('subscription-form').reset();
    document.getElementById('sub-id').value = '';
    document.getElementById('sub-ativo').checked = true;
    
    // Sugerir data padrão (hoje)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sub-proxima-data').value = today;
    
    document.getElementById('subscription-modal').classList.remove('hidden');
}

async function loadSubscriptions() {
    try {
        const subs = await fetchAPI('/api/subscriptions');
        const container = document.getElementById('subscriptions-list');
        container.innerHTML = '';
        
        if (subs.length === 0) {
            container.innerHTML = '<p>Nenhuma subscrição registada.</p>';
            return;
        }
        
        subs.forEach(sub => {
            const div = document.createElement('div');
            div.className = 'subscription-item';
            div.innerHTML = `
                <span>
                    <strong>${sub.nome}</strong> - ${parseFloat(sub.valor).toFixed(2).replace('.', ',')} € (${sub.frequencia})<br>
                    Próximo: ${new Date(sub.data_proximo_pagamento).toLocaleDateString('pt-PT')}
                    ${!sub.ativo ? ' (inativa)' : ''}
                </span>
                <span>
                    <button onclick="editSubscription(${sub.id})">✏️</button>
                    <button class="danger" onclick="deleteSubscription(${sub.id})">🗑️</button>
                </span>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar subscrições:', error);
    }
}

async function saveSubscription(e) {
    e.preventDefault();
    const id = document.getElementById('sub-id').value;
    
    try {
        const data = {
            nome: document.getElementById('sub-nome').value,
            valor: parseFloat(document.getElementById('sub-valor').value.replace(',', '.')),
            frequencia: document.getElementById('sub-frequencia').value,
            dia_pagamento: document.getElementById('sub-dia').value ? parseInt(document.getElementById('sub-dia').value) : null,
            data_proximo_pagamento: document.getElementById('sub-proxima-data').value,
            categoria: document.getElementById('sub-categoria').value || null,
            ativo: document.getElementById('sub-ativo').checked
        };
        
        if (id) {
            await fetchAPI(`/api/subscriptions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetchAPI('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        document.getElementById('subscription-modal').classList.add('hidden');
        await loadAllData();
        
    } catch (error) {
        console.error('Erro ao guardar subscrição:', error);
        alert('Erro ao guardar subscrição');
    }
}

window.editSubscription = async (id) => {
    try {
        const sub = await fetchAPI(`/api/subscriptions/${id}`);
        document.getElementById('sub-id').value = sub.id;
        document.getElementById('sub-nome').value = sub.nome;
        document.getElementById('sub-valor').value = sub.valor;
        document.getElementById('sub-frequencia').value = sub.frequencia;
        document.getElementById('sub-dia').value = sub.dia_pagamento || '';
        document.getElementById('sub-proxima-data').value = sub.data_proximo_pagamento.split('T')[0];
        document.getElementById('sub-categoria').value = sub.categoria || '';
        document.getElementById('sub-ativo').checked = sub.ativo === 1;
        document.getElementById('subscription-modal-title').textContent = 'Editar Subscrição';
        document.getElementById('subscription-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao carregar subscrição:', error);
        alert('Erro ao carregar subscrição');
    }
};

window.deleteSubscription = async (id) => {
    if (!confirm('Eliminar subscrição?')) return;
    
    try {
        await fetchAPI(`/api/subscriptions/${id}`, { method: 'DELETE' });
        await loadAllData();
    } catch (error) {
        console.error('Erro ao eliminar subscrição:', error);
        alert('Erro ao eliminar subscrição');
    }
};

async function processSubscriptions() {
    try {
        await fetchAPI('/api/subscriptions/process', { method: 'POST' });
    } catch (error) {
        console.error('Erro ao processar subscrições:', error);
    }
}

// ========== INVESTIMENTOS ==========

function showAddInvestment() {
    document.getElementById('investment-modal-title').textContent = 'Novo Investimento';
    document.getElementById('investment-form').reset();
    document.getElementById('inv-id').value = '';
    document.getElementById('inv-freq-container').style.display = 'none';
    
    // Sugerir data padrão (hoje)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inv-data').value = today;
    
    document.getElementById('investment-modal').classList.remove('hidden');
}

function toggleInvestmentFrequency() {
    const tipo = document.getElementById('inv-tipo').value;
    const freqContainer = document.getElementById('inv-freq-container');
    freqContainer.style.display = tipo === 'regular' ? 'block' : 'none';
}

async function loadInvestments() {
    try {
        const invs = await fetchAPI('/api/investments');
        const container = document.getElementById('investments-list');
        container.innerHTML = '';
        
        if (invs.length === 0) {
            container.innerHTML = '<p>Nenhum investimento registado.</p>';
            return;
        }
        
        invs.forEach(inv => {
            const div = document.createElement('div');
            div.className = 'investment-item';
            div.innerHTML = `
                <span>
                    <strong>${inv.nome}</strong> - ${parseFloat(inv.valor).toFixed(2).replace('.', ',')} € (${inv.tipo})<br>
                    Data: ${new Date(inv.data).toLocaleDateString('pt-PT')}
                    ${inv.frequencia ? ` (${inv.frequencia})` : ''}
                </span>
                <span>
                    <button onclick="editInvestment(${inv.id})">✏️</button>
                    <button class="danger" onclick="deleteInvestment(${inv.id})">🗑️</button>
                </span>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar investimentos:', error);
    }
}

async function saveInvestment(e) {
    e.preventDefault();
    const id = document.getElementById('inv-id').value;
    
    try {
        const data = {
            nome: document.getElementById('inv-nome').value,
            tipo: document.getElementById('inv-tipo').value,
            valor: parseFloat(document.getElementById('inv-valor').value.replace(',', '.')),
            data: document.getElementById('inv-data').value,
            frequencia: document.getElementById('inv-tipo').value === 'regular' ? document.getElementById('inv-frequencia').value : null,
            categoria: document.getElementById('inv-categoria').value || null,
            observacoes: document.getElementById('inv-obs').value || null
        };
        
        if (id) {
            await fetchAPI(`/api/investments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetchAPI('/api/investments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        document.getElementById('investment-modal').classList.add('hidden');
        await loadAllData();
        
    } catch (error) {
        console.error('Erro ao guardar investimento:', error);
        alert('Erro ao guardar investimento');
    }
}

window.editInvestment = async (id) => {
    try {
        const inv = await fetchAPI(`/api/investments/${id}`);
        document.getElementById('inv-id').value = inv.id;
        document.getElementById('inv-nome').value = inv.nome;
        document.getElementById('inv-tipo').value = inv.tipo;
        document.getElementById('inv-valor').value = inv.valor;
        document.getElementById('inv-data').value = inv.data.split('T')[0];
        
        if (inv.tipo === 'regular') {
            document.getElementById('inv-frequencia').value = inv.frequencia || 'mensal';
            document.getElementById('inv-freq-container').style.display = 'block';
        } else {
            document.getElementById('inv-freq-container').style.display = 'none';
        }
        
        document.getElementById('inv-categoria').value = inv.categoria || '';
        document.getElementById('inv-obs').value = inv.observacoes || '';
        document.getElementById('investment-modal-title').textContent = 'Editar Investimento';
        document.getElementById('investment-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao carregar investimento:', error);
        alert('Erro ao carregar investimento');
    }
};

window.deleteInvestment = async (id) => {
    if (!confirm('Eliminar investimento?')) return;
    
    try {
        await fetchAPI(`/api/investments/${id}`, { method: 'DELETE' });
        await loadAllData();
    } catch (error) {
        console.error('Erro ao eliminar investimento:', error);
        alert('Erro ao eliminar investimento');
    }
};

// ========== UTILITÁRIOS ==========

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('pt-PT');
    } catch (error) {
        return dateStr;
    }
}

function switchTab(e) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    const tab = e.target.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab === 'expenses' ? 'expenses-tab' : 'gains-tab').classList.add('active');
}