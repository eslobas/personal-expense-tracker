const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== VALIDAÇÃO ==========
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v) => typeof v === 'string' && DATE_RE.test(v) && !isNaN(new Date(v));
const isAmount = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
const isId = (v) => /^\d+$/.test(v);
const text = (v, max = 255) => (v === undefined || v === null || v === '') ? null : String(v).trim().slice(0, max);

// Rejeita IDs não numéricos em qualquer rota /:id
app.param('id', (req, res, next, id) => isId(id) ? next() : res.status(400).json({ error: 'ID inválido' }));

function serverError(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
}

// ========== API ROTAS ==========

// Saldo atual
app.get('/api/balance', async (req, res) => {
    try {
        const balance = await db.getCurrentBalance();
        res.json({ balance });
    } catch (err) {
        serverError(res, err);
    }
});

// Transações
app.get('/api/transactions', async (req, res) => {
    try {
        const { tipo, mes, ano } = req.query;
        const transactions = await db.getTransactions(
            tipo,
            mes ? parseInt(mes) : null,
            ano ? parseInt(ano) : null
        );
        res.json(transactions);
    } catch (err) {
        serverError(res, err);
    }
});

app.get('/api/transactions/:id', async (req, res) => {
    try {
        const transaction = await db.getTransactionById(req.params.id);
        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });
        res.json(transaction);
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const { tipo, descricao, valor, data, categoria } = req.body;
        if (!['ganho', 'gasto'].includes(tipo) || !text(descricao) || !isAmount(valor) || !isDate(data)) {
            return res.status(400).json({ error: 'Campos obrigatórios: tipo (ganho|gasto), descricao, valor > 0, data (AAAA-MM-DD)' });
        }
        const id = await db.addTransaction(tipo, text(descricao), Number(valor), data, text(categoria, 100));
        res.status(201).json({ id, message: 'Transação adicionada com sucesso' });
    } catch (err) {
        serverError(res, err);
    }
});

app.put('/api/transactions/:id', async (req, res) => {
    try {
        const { descricao, valor, data, categoria } = req.body;
        if (!text(descricao) || !isAmount(valor) || !isDate(data)) {
            return res.status(400).json({ error: 'Campos obrigatórios: descricao, valor > 0, data' });
        }
        await db.updateTransaction(req.params.id, text(descricao), Number(valor), data, text(categoria, 100));
        res.json({ message: 'Transação atualizada' });
    } catch (err) {
        serverError(res, err);
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        await db.deleteTransaction(req.params.id);
        res.json({ message: 'Transação removida' });
    } catch (err) {
        serverError(res, err);
    }
});

// Settings
app.get('/api/settings/:key', async (req, res) => {
    try {
        const value = await db.getSetting(req.params.key);
        res.json({ key: req.params.key, value });
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!text(key, 100)) return res.status(400).json({ error: 'key obrigatória' });
        await db.setSetting(text(key, 100), value === null || value === undefined ? null : text(value));
        res.json({ message: 'Configuração salva' });
    } catch (err) {
        serverError(res, err);
    }
});

// Totais do mês
app.get('/api/monthly-totals', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) {
            return res.status(400).json({ error: 'Parâmetros mes e ano obrigatórios' });
        }
        const totals = await db.getMonthlyTotals(parseInt(mes), parseInt(ano));
        res.json(totals);
    } catch (err) {
        serverError(res, err);
    }
});



// ========== DINHEIRO FÍSICO ==========
app.get('/api/physical-cash', async (req, res) => {
    try {
        const valor = await db.getPhysicalCash();
        res.json({ valor });
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/physical-cash', async (req, res) => {
    try {
        const { valor } = req.body;
        if (!Number.isFinite(Number(valor)) || Number(valor) < 0) return res.status(400).json({ error: 'Valor inválido' });
        await db.setPhysicalCash(Number(valor));
        res.json({ message: 'Dinheiro físico atualizado' });
    } catch (err) {
        serverError(res, err);
    }
});

// ========== SUBSCRIÇÕES ==========
app.get('/api/subscriptions', async (req, res) => {
    try {
        const ativas = req.query.ativas !== 'false';
        const subs = await db.getSubscriptions(ativas);
        res.json(subs);
    } catch (err) {
        serverError(res, err);
    }
});

app.get('/api/subscriptions/upcoming', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) return res.status(400).json({ error: 'mes e ano obrigatórios' });
        const subs = await db.getSubscriptionsByMonth(parseInt(mes), parseInt(ano));
        res.json(subs);
    } catch (err) {
        serverError(res, err);
    }
});

app.get('/api/subscriptions/:id', async (req, res) => {
    try {
        const sub = await db.getSubscriptionById(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Subscrição não encontrada' });
        res.json(sub);
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/subscriptions', async (req, res) => {
    try {
        const { nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria } = req.body;
        if (!text(nome) || !isAmount(valor) || !['mensal', 'anual', 'semanal', 'outro'].includes(frequencia) || !isDate(data_proximo_pagamento)) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, valor > 0, frequencia, data_proximo_pagamento' });
        }
        const id = await db.addSubscription({ 
            nome, 
            valor: parseFloat(valor), 
            frequencia, 
            dia_pagamento: dia_pagamento ? parseInt(dia_pagamento) : null, 
            data_proximo_pagamento, 
            categoria 
        });
        res.status(201).json({ id, message: 'Subscrição adicionada' });
    } catch (err) {
        serverError(res, err);
    }
});

app.put('/api/subscriptions/:id', async (req, res) => {
    try {
        const { nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria, ativo } = req.body;
        if (!text(nome) || !isAmount(valor) || !['mensal', 'anual', 'semanal', 'outro'].includes(frequencia) || !isDate(data_proximo_pagamento)) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, valor > 0, frequencia, data_proximo_pagamento' });
        }
        await db.updateSubscription(req.params.id, { 
            nome, 
            valor: parseFloat(valor), 
            frequencia, 
            dia_pagamento: dia_pagamento ? parseInt(dia_pagamento) : null, 
            data_proximo_pagamento, 
            categoria, 
            ativo: ativo ? 1 : 0
        });
        res.json({ message: 'Subscrição atualizada' });
    } catch (err) {
        serverError(res, err);
    }
});

app.delete('/api/subscriptions/:id', async (req, res) => {
    try {
        await db.deleteSubscription(req.params.id);
        res.json({ message: 'Subscrição removida' });
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/subscriptions/process', async (req, res) => {
    try {
        const count = await db.processSubscriptions();
        res.json({ message: `${count} subscrições processadas` });
    } catch (err) {
        serverError(res, err);
    }
});

// ========== INVESTIMENTOS ==========
app.get('/api/investments', async (req, res) => {
    try {
        const invs = await db.getInvestments();
        res.json(invs);
    } catch (err) {
        serverError(res, err);
    }
});

app.get('/api/investments/:id', async (req, res) => {
    try {
        const inv = await db.getInvestmentById(req.params.id);
        if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });
        res.json(inv);
    } catch (err) {
        serverError(res, err);
    }
});

app.post('/api/investments', async (req, res) => {
    try {
        const { nome, tipo, valor, data, frequencia, categoria, observacoes } = req.body;
        if (!text(nome) || !text(tipo) || !isAmount(valor) || !isDate(data)) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, tipo, valor > 0, data' });
        }
        const id = await db.addInvestment({ 
            nome, 
            tipo, 
            valor: parseFloat(valor), 
            data, 
            frequencia, 
            categoria, 
            observacoes 
        });
        res.status(201).json({ id, message: 'Investimento registado' });
    } catch (err) {
        serverError(res, err);
    }
});

app.put('/api/investments/:id', async (req, res) => {
    try {
        const { nome, tipo, valor, data, frequencia, categoria, observacoes } = req.body;
        if (!text(nome) || !text(tipo) || !isAmount(valor) || !isDate(data)) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, tipo, valor > 0, data' });
        }
        await db.updateInvestment(req.params.id, { nome, tipo, valor: parseFloat(valor), data, frequencia, categoria, observacoes });
        res.json({ message: 'Investimento atualizado' });
    } catch (err) {
        serverError(res, err);
    }
});

app.delete('/api/investments/:id', async (req, res) => {
    try {
        await db.deleteInvestment(req.params.id);
        res.json({ message: 'Investimento removido' });
    } catch (err) {
        serverError(res, err);
    }
});

// ========== FRONTEND ==========
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});