import { normalizeDate } from '@/lib/format';
import type {
  MonthFilter,
  MonthlyTotals,
  MonthlyTotalsDTO,
  Subscription,
  SubscriptionDTO,
  Transaction,
  TransactionDTO,
  TransactionInput,
} from './types';

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

// ---------- mappers ----------

const toNumber = (value: string | number): number =>
  typeof value === 'number' ? value : Number.parseFloat(value);

export function mapTransaction(dto: TransactionDTO): Transaction {
  return {
    id: dto.id,
    type: dto.tipo === 'ganho' ? 'income' : 'expense',
    description: dto.descricao,
    amount: toNumber(dto.valor),
    date: normalizeDate(dto.data),
    category: dto.categoria || null,
  };
}

export function mapSubscription(dto: SubscriptionDTO): Subscription {
  return {
    id: dto.id,
    name: dto.nome,
    amount: toNumber(dto.valor),
    frequency: dto.frequencia,
    nextPayment: normalizeDate(dto.data_proximo_pagamento),
    category: dto.categoria || null,
    active: Boolean(dto.ativo),
  };
}

function toTransactionBody(input: TransactionInput) {
  return {
    tipo: input.type === 'income' ? 'ganho' : 'gasto',
    descricao: input.description,
    valor: input.amount,
    data: input.date,
    categoria: input.category,
  };
}

// ---------- client ----------

export function createApiClient({ baseUrl, fetchImpl, timeoutMs = 10_000 }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await doFetch(`${root}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new ApiError(
        aborted
          ? 'O servidor demorou demasiado a responder.'
          : 'Não foi possível ligar ao servidor. Verifica a ligação e o endereço da API.',
        0,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const serverMessage =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : null;
      throw new ApiError(serverMessage ?? `Pedido falhou (HTTP ${response.status}).`, response.status);
    }

    return body as T;
  }

  const json = (method: string, data: unknown): RequestInit => ({
    method,
    body: JSON.stringify(data),
  });

  return {
    async getBalance(): Promise<number> {
      const res = await request<{ balance: number | string | null }>('/api/balance');
      return res.balance == null ? 0 : toNumber(res.balance);
    },

    async getTransactions(filter?: MonthFilter): Promise<Transaction[]> {
      const query = filter ? `?mes=${filter.month}&ano=${filter.year}` : '';
      const rows = await request<TransactionDTO[]>(`/api/transactions${query}`);
      return rows.map(mapTransaction);
    },

    async getTransaction(id: number): Promise<Transaction> {
      return mapTransaction(await request<TransactionDTO>(`/api/transactions/${id}`));
    },

    async createTransaction(input: TransactionInput): Promise<number> {
      const res = await request<{ id: number }>('/api/transactions', json('POST', toTransactionBody(input)));
      return res.id;
    },

    /** The API does not allow changing `tipo` on update, so it is not sent. */
    async updateTransaction(id: number, input: TransactionInput): Promise<void> {
      const { tipo: _ignored, ...body } = toTransactionBody(input);
      await request(`/api/transactions/${id}`, json('PUT', body));
    },

    async deleteTransaction(id: number): Promise<void> {
      await request(`/api/transactions/${id}`, { method: 'DELETE' });
    },

    async getMonthlyTotals({ month, year }: MonthFilter): Promise<MonthlyTotals> {
      const res = await request<MonthlyTotalsDTO>(`/api/monthly-totals?mes=${month}&ano=${year}`);
      return { income: toNumber(res.ganhos ?? 0), expenses: toNumber(res.gastos ?? 0) };
    },

    async getSubscriptions(): Promise<Subscription[]> {
      const rows = await request<SubscriptionDTO[]>('/api/subscriptions');
      return rows.map(mapSubscription);
    },

    /** Monthly savings goal stored by the web app under the `meta_poupanca` key. */
    async getSavingsGoal(): Promise<number | null> {
      const res = await request<{ value: string | null }>('/api/settings/meta_poupanca');
      if (res.value == null || res.value === '') return null;
      const value = Number.parseFloat(res.value);
      return Number.isFinite(value) && value > 0 ? value : null;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002';

export const api = createApiClient({ baseUrl: API_URL });
