-- Gestor de Despesas (versão web) — correr uma vez no SQL Editor do Supabase.
-- Cada linha pertence a um utilizador (user_id) e o RLS garante que cada um só vê os seus dados.

create table if not exists public.transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('ganho', 'gasto')),
  descricao  text not null check (char_length(descricao) between 1 and 255),
  valor      numeric(12,2) not null check (valor > 0),
  data       date not null,
  categoria  text check (char_length(categoria) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_data_idx on public.transactions (user_id, data desc);

create table if not exists public.subscriptions (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                   text not null check (char_length(nome) between 1 and 255),
  valor                  numeric(12,2) not null check (valor > 0),
  frequencia             text not null check (frequencia in ('mensal', 'anual', 'semanal')),
  data_proximo_pagamento date not null,
  categoria              text check (char_length(categoria) <= 100),
  ativo                  boolean not null default true
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, data_proximo_pagamento);

create table if not exists public.settings (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  meta_poupanca numeric(12,2) check (meta_poupanca >= 0)
);

alter table public.transactions  enable row level security;
alter table public.subscriptions enable row level security;
alter table public.settings      enable row level security;

-- Uma política por tabela para todas as operações: só as linhas do próprio utilizador.
do $$
declare t text;
begin
  foreach t in array array['transactions', 'subscriptions', 'settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Lança como gasto as subscrições vencidas do utilizador atual (incluindo meses em atraso).
-- SECURITY INVOKER: corre com as permissões de quem chama, logo o RLS continua a aplicar-se.
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
      values (sub.user_id, 'gasto', 'Subscrição: ' || sub.nome, sub.valor, prox, coalesce(sub.categoria, 'Subscrição'));
      n := n + 1;
      k := k + 1;
      -- a partir da data original, para 31 jan → 28 fev → 31 mar (sem "deriva")
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

revoke execute on function public.process_subscriptions() from public, anon;
grant execute on function public.process_subscriptions() to authenticated;
