# Nota a Nota

App de celular (web app instalável) para controlar compras de mercado a partir das notas fiscais.
Cada pessoa cria a própria conta e só enxerga as próprias notas.

**Peças:**
- **GitHub Pages** hospeda o app (grátis).
- **Supabase** guarda login e dados (plano grátis). As regras RLS do banco garantem que cada usuário só lê e grava o que é dele.
- **API do Claude** lê as fotos da nota, chamada por uma Edge Function do Supabase. A chave fica só no servidor.

```
nota-a-nota/
├── index.html, styles.css, app.js     ← o app
├── config.js                          ← URL + chave pública do Supabase (você preenche)
├── manifest.webmanifest, sw.js, icons ← faz virar "app" no celular
└── supabase/
    ├── schema.sql                     ← tabelas + regras de segurança
    └── functions/ler-nota/index.ts    ← lê a foto da nota com o Claude
```

---

## 1. Supabase (banco + login)

1. Crie uma conta em https://supabase.com e um projeto novo (região **São Paulo**). Guarde a senha do banco.
2. **SQL Editor → New query**: cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. **Project Settings → API** (ou *API Keys*): copie a **Project URL** e a chave **anon / publishable**.
   Cole as duas no `config.js`. A chave *anon* é pública por natureza. **Nunca** use a `service_role` / `secret` no app.
4. **Authentication → Sign In / Providers → Email**: deixe ligado. A confirmação de e-mail pode ficar ligada.
5. **Authentication → URL Configuration**:
   - *Site URL*: `https://SEU-USUARIO.github.io/nota-a-nota/`
   - *Redirect URLs*: adicione o mesmo endereço.

   Sem isso, os links de confirmação e de "esqueci a senha" não voltam para o app.

## 2. Chave da API do Claude

1. Em https://console.anthropic.com crie uma API key e coloque créditos (o mínimo já dá para muitos meses).
2. Custo aproximado: alguns centavos de dólar por nota lida, conforme o número de fotos.

## 3. Função que lê a nota (Edge Function)

1. No Supabase: **Edge Functions → Deploy a new function → Via Editor**.
2. Nome: `ler-nota` (exatamente assim). Apague o código de exemplo, cole o conteúdo de `supabase/functions/ler-nota/index.ts` e clique em **Deploy**.
3. Abra a função → **Settings / Details** → **desligue "Verify JWT"** (ou "Enforce JWT verification") e salve. A própria função confere o login de quem chama.
4. **Edge Functions → Secrets**, adicione:

| Nome | Valor | |
|---|---|---|
| `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` | obrigatório |
| `EMAILS_PERMITIDOS` | `voce@email.com,outra@email.com` | opcional: só esses e-mails usam a leitura por foto (que gasta seus créditos) |
| `LIMITE_MENSAL` | `40` | opcional: leituras por pessoa por mês |
| `MODELO` | `claude-sonnet-5-5` | opcional |

## 4. GitHub Pages (hospedagem)

1. No GitHub: **New repository** → nome `nota-a-nota` → **Public** (Pages grátis exige repositório público; não há segredo nenhum nos arquivos) → Create.
2. **Add file → Upload files**: arraste **o conteúdo** da pasta `nota-a-nota` (com o `config.js` já preenchido) → Commit.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch `main`, pasta `/ (root)` → Save.
4. Depois de 1 ou 2 minutos o app fica em `https://SEU-USUARIO.github.io/nota-a-nota/`.

Ou pelo terminal:
```bash
cd nota-a-nota
git init && git add . && git commit -m "Nota a Nota"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/nota-a-nota.git
git push -u origin main
```

## 5. Instalar no iPhone

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone, que já abre em tela cheia, e **crie sua conta ou entre**. O login feito no Safari não vale para o ícone; entre de novo dentro do app.

No Android: Chrome → menu ⋮ → **Instalar app**.

## Várias pessoas

- Mande o link para quem você quiser. Cada pessoa cria a própria conta com e-mail e senha.
- As regras do banco (RLS) separam tudo por usuário: ninguém vê notas, produtos, estoque ou gastos de outra pessoa, nem pelo app nem chamando a API direto.
- Para controlar quem pode entrar:
  - use `EMAILS_PERMITIDOS` para limitar quem gasta seus créditos de leitura;
  - depois que todo mundo criar conta, desligue **Authentication → Sign In / Providers → Allow new users to sign up**. Novas pessoas você convida em **Authentication → Users → Invite user**.
- Se um dia quiserem uma "casa" compartilhada (duas pessoas vendo as mesmas compras), dá para adicionar depois.

## Atualizar o app

Troque os arquivos no repositório. O celular pega a versão nova na próxima vez que abrir o app com internet. Se não aparecer, feche e abra o app de novo.

## Bom saber

- No plano grátis, o projeto Supabase é **pausado após 7 dias sem uso**. Se acontecer, é só entrar no painel e clicar em *Restore*. Usando toda semana, isso não acontece.
- **Dados de exemplo** (botão na tela vazia) ficam só na memória e somem ao sair. Nada é gravado.
- **Esqueci a senha:** o link do e-mail abre no Safari. Crie a senha nova lá e depois entre no app pelo ícone.
