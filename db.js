const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'despesas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ========== SETTINGS ==========
async function getSetting(chave) {
    const [rows] = await pool.execute('SELECT valor FROM settings WHERE chave = ?', [chave]);
    return rows.length ? rows[0].valor : null;
}

async function setSetting(chave, valor) {
    await pool.execute(
        'INSERT INTO settings (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
        [chave, valor, valor]
    );
}

// ========== TRANSAÇÕES ==========
async function addTransaction(tipo, descricao, valor, data, categoria = null) {
    const [result] = await pool.execute(
        'INSERT INTO transactions (tipo, descricao, valor, data, categoria) VALUES (?, ?, ?, ?, ?)',
        [tipo, descricao, valor, data, categoria]
    );
    return result.insertId;
}

async function getTransactions(tipo = null, mes = null, ano = null) {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    if (tipo) {
        sql += ' AND tipo = ?';
        params.push(tipo);
    }
    if (mes && ano) {
        sql += ' AND MONTH(data) = ? AND YEAR(data) = ?';
        params.push(mes, ano);
    }
    sql += ' ORDER BY data DESC';
    const [rows] = await pool.execute(sql, params);
    return rows;
}

async function getTransactionById(id) {
    const [rows] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [id]);
    return rows[0];
}

async function updateTransaction(id, descricao, valor, data, categoria) {
    await pool.execute(
        'UPDATE transactions SET descricao = ?, valor = ?, data = ?, categoria = ? WHERE id = ?',
        [descricao, valor, data, categoria, id]
    );
}

async function deleteTransaction(id) {
    await pool.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

// ========== SALDO ==========
async function getCurrentBalance() {
    // Em vez de usar saldo_inicial, considera que o saldo é apenas a soma das transações
    const [rows] = await pool.execute(
        `SELECT 
            SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END) as total_ganhos,
            SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END) as total_gastos
         FROM transactions`
    );
    const totalGanhos = rows[0].total_ganhos || 0;
    const totalGastos = rows[0].total_gastos || 0;
    return totalGanhos - totalGastos; // Já não usa saldo_inicial
}

async function getMonthlyTotals(mes, ano) {
    const [rows] = await pool.execute(
        `SELECT 
            SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END) as ganhos,
            SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END) as gastos
         FROM transactions 
         WHERE MONTH(data) = ? AND YEAR(data) = ?`,
        [mes, ano]
    );
    return {
        ganhos: rows[0].ganhos ? parseFloat(rows[0].ganhos) : 0,
        gastos: rows[0].gastos ? parseFloat(rows[0].gastos) : 0
    };
}

// ========== DINHEIRO FÍSICO ==========
async function getPhysicalCash() {
    const [rows] = await pool.execute('SELECT valor FROM physical_cash WHERE id = 1');
    return rows.length ? parseFloat(rows[0].valor) : 0;
}

async function setPhysicalCash(valor) {
    await pool.execute('UPDATE physical_cash SET valor = ? WHERE id = 1', [valor]);
}

// ========== SUBSCRIÇÕES ==========
async function addSubscription({ nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria }) {
    const [result] = await pool.execute(
        'INSERT INTO subscriptions (nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria]
    );
    return result.insertId;
}

async function getSubscriptions(ativas = true) {
    const [rows] = await pool.execute('SELECT * FROM subscriptions WHERE ativo = ? ORDER BY data_proximo_pagamento', [ativas]);
    return rows;
}

async function getSubscriptionsByMonth(mes, ano) {
    const [rows] = await pool.execute(
        'SELECT * FROM subscriptions WHERE ativo = 1 AND MONTH(data_proximo_pagamento) = ? AND YEAR(data_proximo_pagamento) = ?',
        [mes, ano]
    );
    return rows;
}

async function getSubscriptionById(id) {
    const [rows] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [id]);
    return rows[0];
}

async function updateSubscription(id, fields) {
    const { nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria, ativo } = fields;
    await pool.execute(
        'UPDATE subscriptions SET nome = ?, valor = ?, frequencia = ?, dia_pagamento = ?, data_proximo_pagamento = ?, categoria = ?, ativo = ? WHERE id = ?',
        [nome, valor, frequencia, dia_pagamento, data_proximo_pagamento, categoria, ativo, id]
    );
}

async function deleteSubscription(id) {
    await pool.execute('DELETE FROM subscriptions WHERE id = ?', [id]);
}

async function processSubscriptions() {
    const hoje = new Date().toISOString().split('T')[0];
    const [vencidas] = await pool.execute(
        'SELECT * FROM subscriptions WHERE ativo = 1 AND data_proximo_pagamento <= ?',
        [hoje]
    );
    for (const sub of vencidas) {
        await addTransaction(
            'gasto',
            `Subscrição: ${sub.nome}`,
            sub.valor,
            sub.data_proximo_pagamento,
            sub.categoria || 'Subscrição'
        );
        
        let proximaData = new Date(sub.data_proximo_pagamento);
        switch (sub.frequencia) {
            case 'mensal':
                proximaData.setMonth(proximaData.getMonth() + 1);
                break;
            case 'anual':
                proximaData.setFullYear(proximaData.getFullYear() + 1);
                break;
            case 'semanal':
                proximaData.setDate(proximaData.getDate() + 7);
                break;
        }
        const proximaDataStr = proximaData.toISOString().split('T')[0];
        await pool.execute(
            'UPDATE subscriptions SET data_proximo_pagamento = ? WHERE id = ?',
            [proximaDataStr, sub.id]
        );
    }
    return vencidas.length;
}

// ========== INVESTIMENTOS ==========
async function addInvestment({ nome, tipo, valor, data, frequencia, categoria, observacoes }) {
    const [result] = await pool.execute(
        'INSERT INTO investments (nome, tipo, valor, data, frequencia, categoria, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nome, tipo, valor, data, frequencia, categoria, observacoes]
    );
    return result.insertId;
}

async function getInvestments() {
    const [rows] = await pool.execute('SELECT * FROM investments ORDER BY data DESC');
    return rows;
}

async function getInvestmentById(id) {
    const [rows] = await pool.execute('SELECT * FROM investments WHERE id = ?', [id]);
    return rows[0];
}

async function updateInvestment(id, fields) {
    const { nome, tipo, valor, data, frequencia, categoria, observacoes } = fields;
    await pool.execute(
        'UPDATE investments SET nome = ?, tipo = ?, valor = ?, data = ?, frequencia = ?, categoria = ?, observacoes = ? WHERE id = ?',
        [nome, tipo, valor, data, frequencia, categoria, observacoes, id]
    );
}

async function deleteInvestment(id) {
    await pool.execute('DELETE FROM investments WHERE id = ?', [id]);
}

module.exports = {
    getSetting,
    setSetting,
    addTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    getCurrentBalance,
    getMonthlyTotals,
    getPhysicalCash,
    setPhysicalCash,
    addSubscription,
    getSubscriptions,
    getSubscriptionsByMonth,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    processSubscriptions,
    addInvestment,
    getInvestments,
    getInvestmentById,
    updateInvestment,
    deleteInvestment
};