-- Personal Expense Tracker — MySQL schema
-- Run:  mysql -u root -p < schema.sql
-- (or:  CREATE DATABASE despesas;  then  USE despesas;  then run the rest)

CREATE DATABASE IF NOT EXISTS despesas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE despesas;

-- Income / expense ledger. tipo: 'ganho' (income) | 'gasto' (expense)
CREATE TABLE IF NOT EXISTS transactions (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  tipo      ENUM('ganho','gasto') NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor     DECIMAL(12,2) NOT NULL,
  data      DATE NOT NULL,
  categoria VARCHAR(100) DEFAULT NULL,
  INDEX idx_tx_data (data),
  INDEX idx_tx_tipo (tipo)
);

-- Key/value app settings (e.g. monthly salary check, savings goal)
CREATE TABLE IF NOT EXISTS settings (
  chave VARCHAR(100) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL
);

-- Cash held outside the bank, tracked as a single row (id = 1)
CREATE TABLE IF NOT EXISTS physical_cash (
  id    INT PRIMARY KEY,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0
);
INSERT INTO physical_cash (id, valor) VALUES (1, 0)
  ON DUPLICATE KEY UPDATE id = id;

-- Recurring payments. frequencia: 'mensal' | 'anual' | 'semanal'
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  nome                    VARCHAR(255) NOT NULL,
  valor                   DECIMAL(12,2) NOT NULL,
  frequencia              ENUM('mensal','anual','semanal') NOT NULL,
  dia_pagamento           INT DEFAULT NULL,
  data_proximo_pagamento  DATE NOT NULL,
  categoria               VARCHAR(100) DEFAULT NULL,
  ativo                   TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_sub_prox (data_proximo_pagamento)
);

-- Investments (also recorded as a 'gasto' transaction when created)
CREATE TABLE IF NOT EXISTS investments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(255) NOT NULL,
  tipo        VARCHAR(100) NOT NULL,
  valor       DECIMAL(12,2) NOT NULL,
  data        DATE NOT NULL,
  frequencia  VARCHAR(50) DEFAULT NULL,
  categoria   VARCHAR(100) DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  INDEX idx_inv_data (data)
);
