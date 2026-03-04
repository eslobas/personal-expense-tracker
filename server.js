const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== API ROTAS ==========

// Saldo atual
app.get('/api/balance', async (req, res) => {
    try {
        const balance = await db.getCurrentBalance();
        res.json({ balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions/:id', async (req, res) => {
    try {
        const transaction = await db.getTransactionById(req.params.id);
        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });
        res.json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    console.log('POST /api/transactions - body:', req.body);
    try {
        const { tipo, descricao, valor, data, categoria } = req.body;
        console.log('Campos recebidos:', { tipo, descricao, valor, data, categoria });
        
        if (!tipo || !descricao || !valor || !data) {
            console.log('Campos em falta:', { tipo, descricao, valor, data });
            return res.status(400).json({ error: 'Campos obrigatórios: tipo, descricao, valor, data' });
        }
        
        const id = await db.addTransaction(tipo, descricao, parseFloat(valor), data, categoria);
        console.log('Transação adicionada com ID:', id);
        
        res.status(201).json({ id, message: 'Transação adicionada com sucesso' });
    } catch (err) {
        console.error('Erro ao adicionar transação:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/transactions/:id', async (req, res) => {
    try {
        const { descricao, valor, data, categoria } = req.body;
        await db.updateTransaction(req.params.id, descricao, parseFloat(valor), data, categoria);
        res.json({ message: 'Transação atualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        await db.deleteTransaction(req.params.id);
        res.json({ message: 'Transação removida' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Settings
app.get('/api/settings/:key', async (req, res) => {
    try {
        const value = await db.getSetting(req.params.key);
        res.json({ key: req.params.key, value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await db.setSetting(key, value);
        res.json({ message: 'Configuração salva' });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        console.log('Monthly totals para', mes, ano, ':', totals); // Log para debug
        res.json(totals);
    } catch (err) {
        console.error('Erro em monthly-totals:', err);
        res.status(500).json({ error: err.message });
    }
});



// ========== DINHEIRO FÍSICO ==========
app.get('/api/physical-cash', async (req, res) => {
    try {
        const valor = await db.getPhysicalCash();
        res.json({ valor });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/physical-cash', async (req, res) => {
    try {
        const { valor } = req.body;
        if (valor === undefined) return res.status(400).json({ error: 'Valor é obrigatório' });
        await db.setPhysicalCash(parseFloat(valor));
        res.json({ message: 'Dinheiro físico atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== SUBSCRIÇÕES ==========
app.get('/api/subscriptions', async (req, res) => {
    try {
        const ativas = req.query.ativas !== 'false';
        const subs = await db.getSubscriptions(ativas);
        res.json(subs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subscriptions/upcoming', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) return res.status(400).json({ error: 'mes e ano obrigatórios' });
        const subs = await db.getSubscriptionsByMonth(parseInt(mes), parseInt(ano));
        res.json(subs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subscriptions/:id', async (req, res) => {
    try {
        const sub = await db.getSubscriptionById(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Subscrição não encontrada' });
        res.json(sub);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subscriptions', async (req, res) => {
    try {
        const { nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria } = req.body;
        if (!nome || !valor || !frequencia || !data_proximo_pagamento) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, valor, frequencia, data_proximo_pagamento' });
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
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/subscriptions/:id', async (req, res) => {
    try {
        const { nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria, ativo } = req.body;
        await db.updateSubscription(req.params.id, { 
            nome, 
            valor: parseFloat(valor), 
            frequencia, 
            dia_pagamento: dia_pagamento ? parseInt(dia_pagamento) : null, 
            data_proximo_pagamento, 
            categoria, 
            ativo 
        });
        res.json({ message: 'Subscrição atualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/subscriptions/:id', async (req, res) => {
    try {
        await db.deleteSubscription(req.params.id);
        res.json({ message: 'Subscrição removida' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subscriptions/process', async (req, res) => {
    try {
        const count = await db.processSubscriptions();
        res.json({ message: `${count} subscrições processadas` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== INVESTIMENTOS ==========
app.get('/api/investments', async (req, res) => {
    try {
        const invs = await db.getInvestments();
        res.json(invs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/investments/:id', async (req, res) => {
    try {
        const inv = await db.getInvestmentById(req.params.id);
        if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });
        res.json(inv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/investments', async (req, res) => {
    try {
        const { nome, tipo, valor, data, frequencia, categoria, observacoes } = req.body;
        if (!nome || !tipo || !valor || !data) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, tipo, valor, data' });
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
        // Criar transação de gasto associada
        await db.addTransaction('gasto', `Investimento: ${nome}`, parseFloat(valor), data, 'Investimento');
        res.status(201).json({ id, message: 'Investimento registado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/investments/:id', async (req, res) => {
    try {
        const { nome, tipo, valor, data, frequencia, categoria, observacoes } = req.body;
        await db.updateInvestment(req.params.id, { nome, tipo, valor: parseFloat(valor), data, frequencia, categoria, observacoes });
        res.json({ message: 'Investimento atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/investments/:id', async (req, res) => {
    try {
        await db.deleteInvestment(req.params.id);
        res.json({ message: 'Investimento removido' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== FRONTEND ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});