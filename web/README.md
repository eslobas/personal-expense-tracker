# Gestor de Despesas — versão web (multi-utilizador)

Versão simplificada, 100% estática, que corre de graça: **Supabase** (login + base de dados) +
**Vercel/Netlify** (alojamento). Cada pessoa entra com o email (link mágico, sem password) e só
vê os seus dados, garantido pelo RLS na base de dados.

Inclui: saldo, resumo do mês com meta de poupança, ganhos/gastos (editar/eliminar), navegação
por mês e subscrições lançadas automaticamente. Fica de fora (só na versão completa): investimentos,
dinheiro físico e aviso de salário.

## Pôr online (≈10 min)

1. **Supabase** → [supabase.com](https://supabase.com) → *New project* (plano Free).
2. **SQL Editor** → colar o conteúdo de `supabase.sql` → *Run*.
3. **Project Settings → API** → copiar *Project URL* e a *publishable/anon key* para `config.js`.
4. **Alojar a pasta `web/`**:
   - Netlify: [app.netlify.com/drop](https://app.netlify.com/drop) → arrastar a pasta `web`; ou
   - Vercel: *Add New → Project* → importar o repo → *Root Directory* = `web`.
5. **Supabase → Authentication → URL Configuration** → *Site URL* = o link do passo 4
   (e adicionar o mesmo em *Redirect URLs*). Sem isto o link do email aponta para localhost.

> O envio de emails incluído no Supabase gratuito tem um limite baixo por hora. Para mais utilizadores,
> configurar SMTP próprio (ex.: Resend, grátis) em *Authentication → Emails → SMTP*.

## Testar localmente

```bash
npx serve web     # e adicionar http://localhost:3000 às Redirect URLs do Supabase
```
