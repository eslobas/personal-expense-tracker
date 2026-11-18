import { ApiError, createApiClient } from '../client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

function setup(...responses: Array<Response | Error>) {
  const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>();
  for (const r of responses) {
    if (r instanceof Error) fetchImpl.mockRejectedValueOnce(r);
    else fetchImpl.mockResolvedValueOnce(r);
  }
  const client = createApiClient({ baseUrl: 'http://192.168.1.10:3002/', fetchImpl });
  return { client, fetchImpl };
}

describe('api client', () => {
  it('requests transactions for a month and maps the MySQL payload to domain objects', async () => {
    const { client, fetchImpl } = setup(
      jsonResponse([
        { id: 7, tipo: 'gasto', descricao: 'Supermercado', valor: '23.40', data: '2026-11-12', categoria: 'Casa' },
        { id: 8, tipo: 'ganho', descricao: 'Salário', valor: 1200, data: '2026-11-01', categoria: null },
      ]),
    );

    const result = await client.getTransactions({ month: 11, year: 2026 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://192.168.1.10:3002/api/transactions?mes=11&ano=2026');
    expect(result).toEqual([
      { id: 7, type: 'expense', description: 'Supermercado', amount: 23.4, date: '2026-11-12', category: 'Casa' },
      { id: 8, type: 'income', description: 'Salário', amount: 1200, date: '2026-11-01', category: null },
    ]);
  });

  it('converts ISO timestamps from the API back to the local calendar date', async () => {
    const local = new Date(2026, 10, 5); // 5 Nov 2026, local midnight
    const { client } = setup(
      jsonResponse({ id: 1, tipo: 'gasto', descricao: 'x', valor: '1.00', data: local.toISOString(), categoria: '' }),
    );

    const tx = await client.getTransaction(1);

    expect(tx.date).toBe('2026-11-05');
    expect(tx.category).toBeNull();
  });

  it('sends a POST with the API field names when creating a transaction', async () => {
    const { client, fetchImpl } = setup(jsonResponse({ id: 42, message: 'ok' }, 201));

    const id = await client.createTransaction({
      type: 'income',
      description: 'Freelance',
      amount: 150.5,
      date: '2026-11-18',
      category: null,
    });

    expect(id).toBe(42);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://192.168.1.10:3002/api/transactions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      tipo: 'ganho',
      descricao: 'Freelance',
      valor: 150.5,
      data: '2026-11-18',
      categoria: null,
    });
  });

  it('does not send the transaction type on update (the API does not support changing it)', async () => {
    const { client, fetchImpl } = setup(jsonResponse({ message: 'ok' }));

    await client.updateTransaction(3, {
      type: 'expense',
      description: 'Renda',
      amount: 500,
      date: '2026-11-01',
      category: 'Casa',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://192.168.1.10:3002/api/transactions/3');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      descricao: 'Renda',
      valor: 500,
      data: '2026-11-01',
      categoria: 'Casa',
    });
  });

  it('maps monthly totals, balance and the savings goal', async () => {
    const { client } = setup(
      jsonResponse({ ganhos: 1500, gastos: 420.75 }),
      jsonResponse({ balance: '980.10' }),
      jsonResponse({ key: 'meta_poupanca', value: '300' }),
    );

    await expect(client.getMonthlyTotals({ month: 11, year: 2026 })).resolves.toEqual({
      income: 1500,
      expenses: 420.75,
    });
    await expect(client.getBalance()).resolves.toBe(980.1);
    await expect(client.getSavingsGoal()).resolves.toBe(300);
  });

  it('returns null when no savings goal is set', async () => {
    const { client } = setup(jsonResponse({ key: 'meta_poupanca', value: null }));
    await expect(client.getSavingsGoal()).resolves.toBeNull();
  });

  it('maps subscriptions', async () => {
    const { client } = setup(
      jsonResponse([
        {
          id: 2,
          nome: 'Spotify',
          valor: '7.99',
          frequencia: 'mensal',
          dia_pagamento: 3,
          data_proximo_pagamento: '2026-12-03',
          categoria: 'Lazer',
          ativo: 1,
        },
      ]),
    );

    await expect(client.getSubscriptions()).resolves.toEqual([
      {
        id: 2,
        name: 'Spotify',
        amount: 7.99,
        frequency: 'mensal',
        nextPayment: '2026-12-03',
        category: 'Lazer',
        active: true,
      },
    ]);
  });

  it('throws an ApiError with the server message on HTTP errors', async () => {
    const { client } = setup(jsonResponse({ error: 'Campos obrigatórios: tipo, descricao, valor, data' }, 400));

    const promise = client.createTransaction({
      type: 'expense',
      description: '',
      amount: 1,
      date: '2026-11-18',
      category: null,
    });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: 'Campos obrigatórios: tipo, descricao, valor, data',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    const { client } = setup({ ok: false, status: 502, text: () => Promise.resolve('<html>') } as Response);
    await expect(client.getBalance()).rejects.toMatchObject({ status: 502, message: 'Pedido falhou (HTTP 502).' });
  });

  it('turns network failures into an ApiError with status 0', async () => {
    const { client } = setup(new TypeError('Network request failed'));
    await expect(client.getSubscriptions()).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });
});
