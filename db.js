const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'despesas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Devolve DATE como 'YYYY-MM-DD' (evita desvios de fuso horário no browser)
    dateStrings: true,
    decimalNumbers: true
});

// Data local de hoje em 'YYYY-MM-DD' (toISOString usa UTC e pode dar o dia errado)
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Avança uma data 'YYYY-MM-DD' segundo a frequência, sem saltar meses curtos (31 jan → 28/29 fev)
function nextDate(dateStr, frequencia, diaPagamento = null) {
    const [y, m, d] = dateStr.split('-').map(Number);
    let date;
    if (frequencia === 'semanal') {
        date = new Date(y, m - 1, d + 7);
    } else {
        const months = frequencia === 'anual' ? 12 : 1;
        const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
        date = new Date(y, m - 1 + months, Math.min(diaPagamento || d, lastDay));
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ========== SETTINGS ==========
async function getSetting(chave) {
    const [rows] = await pool.execute('SELECT valor FROM settings WHERE chave = ?', [chave]);
    return rows.length ? rows[0].valor : null;
}

async function setSetting(chave, valor) {
    if (valor === null || valor === undefined || valor === '') {
        await pool.execute('DELETE FROM settings WHERE chave = ?', [chave]);
        return;
    }
    await pool.execute(
        'INSERT INTO settings (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
        [chave, String(valor), String(valor)]
    );
}

// ========== TRANSAÇÕES ==========
async function addTransaction(tipo, descricao, valor, data, categoria = null, conn = pool) {
    const [result] = await conn.execute(
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
    const [rows] = await pool.execute(
        `SELECT 
            SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END) as total_ganhos,
            SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END) as total_gastos
         FROM transactions`
    );
    return Number(rows[0].total_ganhos || 0) - Number(rows[0].total_gastos || 0);
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
    await pool.execute(
        'INSERT INTO physical_cash (id, valor) VALUES (1, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
        [valor]
    );
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

// Lança como gasto todas as subscrições vencidas (incluindo períodos em atraso).
// Corre numa transação com FOR UPDATE para que dois pedidos simultâneos não cobrem a dobrar.
// Subscrições com frequência 'outro' não são automáticas (não há como calcular a próxima data).
async function processSubscriptions() {
    const hoje = today();
    const conn = await pool.getConnection();
    let count = 0;
    try {
        await conn.beginTransaction();
        const [vencidas] = await conn.execute(
            `SELECT * FROM subscriptions
             WHERE ativo = 1 AND frequencia IN ('mensal','anual','semanal') AND data_proximo_pagamento <= ?
             FOR UPDATE`,
            [hoje]
        );
        for (const sub of vencidas) {
            let data = sub.data_proximo_pagamento;
            while (data <= hoje) {
                await addTransaction('gasto', `Subscrição: ${sub.nome}`, sub.valor, data, sub.categoria || 'Subscrição', conn);
                data = nextDate(data, sub.frequencia, sub.dia_pagamento);
                count++;
            }
            await conn.execute('UPDATE subscriptions SET data_proximo_pagamento = ? WHERE id = ?', [data, sub.id]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    return count;
}

// ========== INVESTIMENTOS ==========
// Um investimento é também um gasto: cria/atualiza/remove a transação ligada (transaction_id)
// na mesma transação SQL, para os dois nunca ficarem dessincronizados.
async function withTransaction(fn) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function addInvestment({ nome, tipo, valor, data, frequencia, categoria, observacoes }) {
    return withTransaction(async (conn) => {
        const txId = await addTransaction('gasto', `Investimento: ${nome}`, valor, data, 'Investimento', conn);
        const [result] = await conn.execute(
            'INSERT INTO investments (nome, tipo, valor, data, frequencia, categoria, observacoes, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, tipo, valor, data, frequencia, categoria, observacoes, txId]
        );
        return result.insertId;
    });
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
    await withTransaction(async (conn) => {
        await conn.execute(
            'UPDATE investments SET nome = ?, tipo = ?, valor = ?, data = ?, frequencia = ?, categoria = ?, observacoes = ? WHERE id = ?',
            [nome, tipo, valor, data, frequencia, categoria, observacoes, id]
        );
        await conn.execute(
            `UPDATE transactions t JOIN investments i ON i.transaction_id = t.id
             SET t.descricao = ?, t.valor = ?, t.data = ? WHERE i.id = ?`,
            [`Investimento: ${nome}`, valor, data, id]
        );
    });
}

async function deleteInvestment(id) {
    await withTransaction(async (conn) => {
        const [rows] = await conn.execute('SELECT transaction_id FROM investments WHERE id = ?', [id]);
        await conn.execute('DELETE FROM investments WHERE id = ?', [id]);
        if (rows[0]?.transaction_id) {
            await conn.execute('DELETE FROM transactions WHERE id = ?', [rows[0].transaction_id]);
        }
    });
}

module.exports = {
    today,
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