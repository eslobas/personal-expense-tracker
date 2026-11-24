/**
 * Wire types mirror the Express/MySQL API exactly (Portuguese column names,
 * DECIMAL columns arrive as strings, DATE columns as ISO timestamps).
 * Domain types are what the UI works with.
 */

// ---------- wire (API) ----------

export type TransactionKindDTO = 'ganho' | 'gasto';

export interface TransactionDTO {
  id: number;
  tipo: TransactionKindDTO;
  descricao: string;
  valor: string | number;
  data: string;
  categoria: string | null;
}

export type SubscriptionFrequency = 'mensal' | 'anual' | 'semanal' | 'outro';

export interface SubscriptionDTO {
  id: number;
  nome: string;
  valor: string | number;
  frequencia: SubscriptionFrequency;
  dia_pagamento: number | null;
  data_proximo_pagamento: string;
  categoria: string | null;
  ativo: number | boolean;
}

export interface MonthlyTotalsDTO {
  ganhos: number;
  gastos: number;
}

// ---------- domain (UI) ----------

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: number;
  type: TransactionType;
  description: string;
  amount: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  category: string | null;
}

export interface TransactionInput {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  category: string | null;
}

export interface Subscription {
  id: number;
  name: string;
  amount: number;
  frequency: SubscriptionFrequency;
  nextPayment: string;
  category: string | null;
  active: boolean;
}

export interface MonthlyTotals {
  income: number;
  expenses: number;
}

export interface MonthFilter {
  month: number;
  year: number;
}
