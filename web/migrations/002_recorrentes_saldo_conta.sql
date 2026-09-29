-- Migração 002 — correr uma vez no SQL Editor (projetos criados antes desta versão).
-- 1) Recorrentes podem ser ganhos (ex.: salário) e não só gastos
-- 2) Saldo e evolução calculados na base de dados (a API devolve no máx. 1000 linhas por pedido,
--    por isso somar no browser ficava errado a partir de 1000 movimentos)
-- 3) Apagar a própria conta (e todos os dados, por cascata)

alter table public.subscriptions
  add column if not exists tipo text not null default 'gasto' check (tipo in ('ganho', 'gasto'));

create or replace function public.process_subscriptions()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sub   public.subscriptions;
  prox  date;
  n     integer := 0;
  k     integer;
begin
  for sub in
    select * from public.subscriptions
    where user_id = auth.uid() and ativo and data_proximo_pagamento <= current_date
    for update
  loop
    prox := sub.data_proximo_pagamento;
    k := 0;
    while prox <= current_date loop
      insert into public.transactions (user_id, tipo, descricao, valor, data, categoria)
      values (
        sub.user_id, sub.tipo,
        case when sub.tipo = 'gasto' then 'Subscrição: ' || sub.nome else sub.nome end,
        sub.valor, prox,
        coalesce(sub.categoria, case when sub.tipo = 'gasto' then 'Subscrição' else 'Rendimento' end)
      );
      n := n + 1;
      k := k + 1;
      prox := case sub.frequencia
        when 'semanal' then sub.data_proximo_pagamento + 7 * k
        when 'anual'   then (sub.data_proximo_pagamento + make_interval(years => k))::date
        else                (sub.data_proximo_pagamento + make_interval(months => k))::date
      end;
    end loop;
    update public.subscriptions set data_proximo_pagamento = prox where id = sub.id;
  end loop;
  return n;
end $$;

-- Saldo total do utilizador atual
create or replace function public.get_balance()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when tipo = 'ganho' then valor else -valor end), 0)
  from public.transactions
  where user_id = auth.uid();
$$;

-- Ganhos e gastos por mês, a partir de uma data (para o gráfico de evolução)
create or replace function public.monthly_totals(desde date)
returns table (mes date, ganhos numeric, gastos numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select date_trunc('month', data)::date as mes,
         coalesce(sum(valor) filter (where tipo = 'ganho'), 0) as ganhos,
         coalesce(sum(valor) filter (where tipo = 'gasto'), 0) as gastos
  from public.transactions
  where user_id = auth.uid() and data >= desde
  group by 1
  order by 1;
$$;

-- Apagar a conta: precisa de SECURITY DEFINER para mexer em auth.users,
-- mas só apaga a linha do próprio utilizador (auth.uid()).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.process_subscriptions() from public, anon;
revoke execute on function public.get_balance()           from public, anon;
revoke execute on function public.monthly_totals(date)    from public, anon;
revoke execute on function public.delete_account()        from public, anon;
grant  execute on function public.process_subscriptions() to authenticated;
grant  execute on function public.get_balance()           to authenticated;
grant  execute on function public.monthly_totals(date)    to authenticated;
grant  execute on function public.delete_account()        to authenticated;
