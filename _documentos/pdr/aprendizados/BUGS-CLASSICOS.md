# Bugs Clássicos — Lições Duras

> 10+ bugs vivenciados em produção e como resolver. Vale ouro.

## Bug 1 — `auth.admin.listUsers()` paginado a 50

**Sintoma:** Edge function que busca user por email retorna 404 pra usuários "novos" (criados depois dos 50 primeiros do banco). Outros funcionam.

**Causa raiz:** `supabase.auth.admin.listUsers()` retorna **só os primeiros 50 por padrão**. Se você fizer `listUsers().find(u => u.email === x)`, e o usuário não está nos primeiros 50, retorna `undefined`.

**Pior:** quando algum usuário no banco tem `email_change` NULL (bug interno do Supabase), `listUsers()` retorna 500 com:
```
unable to fetch records: sql: Scan error on column index 8, name "email_change": converting NULL to string is unsupported
```

**Fix:** RPC SECURITY DEFINER que faz query SQL direta:

```sql
CREATE FUNCTION public.get_auth_user_id_by_email(p_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
```

Edge function chama RPC em vez de listUsers:

```typescript
const { data: userId } = await supabase.rpc('get_auth_user_id_by_email', { p_email: email });
if (!userId) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
await supabase.auth.admin.updateUserById(userId, { password });
```

## Bug 2 — Cache do PostgREST após criar tabela

**Sintoma:** Acabou de criar tabela via SQL Editor. Cliente PostgREST retorna `404 PGRST205 "Could not find the table 'X' in the schema cache"`.

**Causa raiz:** PostgREST mantém schema em cache. Quando você cria tabela direto via SQL, o cache não atualiza automaticamente. Pode levar até 10-15 min.

**Fix imediato:**
```sql
NOTIFY pgrst, 'reload schema';
```

**Aprendizado meta:** Eu inicialmente interpretei o 404 como "tabela não existe" e tentei aplicar migration de novo. **Sempre verifique se é cache antes de aplicar SQL de novo** (vai dar erro de "duplicate" e você se confunde mais).

## Bug 3 — Migrations dessincronizadas (Dashboard vs CLI)

**Sintoma:** `supabase db push` retorna:
```
Remote migration versions not found in local migrations directory.
```

**Causa raiz:** Alguém aplicou SQL direto no Dashboard ao longo do tempo. O remote tem 165 migrations registradas em `supabase_migrations.schema_migrations` que não existem como arquivo local.

**Fix:**

```bash
supabase migration repair --status applied <id1> <id2> ... <id165>
```

Marca essas como aplicadas no histórico local (sem rodar SQL). Depois `db push` funciona normal.

**Prevenção:** Time inteiro deve usar **uma só ferramenta** pra migrations. Decida: ou Dashboard ou CLI. Misturar é dor.

## Bug 4 — Order_index alfabético em journey_tracks

**Sintoma:** Aluno clica "Ir pra próxima aula" no Starter mas vai pra primeira aula do Builder.

**Causa raiz:** Query faz `.order('project_id')` que é **alfabético**. `b` (Builder) vem antes de `s` (Starter).

**Fix:**

```typescript
// fetchStudyMetrics — ordenar pela ordem do array projectIds passado
const ordered = lessons.sort((a, b) => {
  const ai = projectIds.indexOf(a.project_id);
  const bi = projectIds.indexOf(b.project_id);
  if (ai !== bi) return ai - bi;
  return (a.module_order || 0) - (b.module_order || 0) || (a.order_index || 0) - (b.order_index || 0);
});
```

E garantir que `projectIds` chega ordenado corretamente:

```typescript
const FIXED_ORDER = ['starter', 'builder'];
const sorted = ids.sort((a, b) => {
  const ai = FIXED_ORDER.indexOf(a);
  const bi = FIXED_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return 0;
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});
```

**Aprendizado meta:** Sempre garantir critério de **desempate explícito** em queries com múltiplos `ORDER BY`. Postgres não promete ordem estável sem isso.

## Bug 5 — Webhook do AssemblyAI processando mas frontend não atualiza

**Sintoma:** Aula transcrita, mas página de aula continua "Processando..." pra sempre.

**Causa raiz:** React Query cache. O hook `useLesson(id)` com `staleTime` longo não invalida quando webhook atualiza o banco.

**Fix:**

```typescript
// 1. Reduzir staleTime pra dados que mudam por webhook
useQuery({ queryKey: ['lesson', id], staleTime: 5000 });

// 2. OU usar Supabase Realtime
useEffect(() => {
  const channel = supabase.channel('lesson-updates')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lessons', filter: `id=eq.${id}` }, () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', id] });
    })
    .subscribe();
  return () => { channel.unsubscribe(); };
}, [id]);
```

## Bug 6 — Edge Function timeout de 150s

**Sintoma:** Edge function que processa aula (cleanTranscription + Gemini + thumb + PDF) retorna 504 após 150s.

**Causa raiz:** Cada operação síncrona soma. Total ultrapassa 150s.

**Fix:** Use `EdgeRuntime.waitUntil()` pra rodar tarefas longas em background:

```typescript
serve(async (req) => {
  // Tarefa principal (rápida)
  const result = await processQuick();
  
  // Tarefa longa em background
  const bgWork = async () => {
    await generateThumbnail(); // 30s
    await generatePDF();        // 20s
  };
  
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(bgWork());
  else bgWork().catch(console.error);
  
  return new Response(JSON.stringify(result), { status: 200 });
});
```

Função retorna em ~10s, tarefas longas continuam em background.

## Bug 7 — Cliente WhatsApp UAZAPI: Group JID errado

**Sintoma:** Mensagem retorna 200 mas não aparece no grupo.

**Causa raiz:** Grupo JID tem formato específico: `120363xxxxxxxxxxxxxxxx@g.us` (não `@s.whatsapp.net`).

**Fix:**
- Mensagem direta: `5511999999999@s.whatsapp.net`
- Grupo: `120363xxx@g.us`

Pra descobrir JID do grupo, use endpoint `/group/info` do UAZAPI ou pegue dos metadados quando o bot recebe primeira mensagem do grupo.

## Bug 8 — Panda Video: download "only Converted video"

**Sintoma:** Edge function que baixa MP4 do Panda retorna:
```
{"error": "Download only Converted video"}
```

**Causa raiz:** Vídeo recém-uploadado ainda não foi convertido. Conversão leva 5-10min após upload.

**Fix:** Polling com timeout adequado:

```typescript
let mp4Url = '';
const maxAttempts = 60; // 5 minutos
for (let i = 0; i < maxAttempts; i++) {
  await sleep(5000);
  const status = await fetch(`https://api-v2.pandavideo.com/download-async/${videoId}/video/360p/pt-BR`, {
    headers: { 'Authorization': PANDA_TOKEN }
  });
  if (status.ok) {
    const data = await status.json();
    if (data.status === 'ready') { mp4Url = data.url; break; }
  }
}
if (!mp4Url) throw new Error('Timeout esperando conversão Panda');
```

## Bug 9 — Sidebar mobile escondendo conteúdo crítico

**Sintoma:** No mobile, alunos não conseguem acessar `/na-pratica` (página de trilhas).

**Causa raiz:** A aba "Aulas" do MobileTabBar levava direto pra `/encontros-ao-vivo`. Não havia atalho pra Trilhas.

**Fix:** Renomeei aba "Aulas" → "Trilhas" e mudei rota pra `/na-pratica`. `match` continua cobrindo `/encontros-ao-vivo` pra ficar ativa lá também.

**Aprendizado meta:** **Teste em mobile sempre**. Bugs de navegação só aparecem no device pequeno.

## Bug 10 — Migration aplicada parcialmente (transações implícitas)

**Sintoma:** Apliquei migration de 200 linhas. Falhou no meio. Banco fica em estado inconsistente.

**Causa raiz:** Supabase aplicou em transação implícita, mas algumas operações DDL não são reversíveis dentro de transação (ex: `CREATE TYPE`).

**Fix:** Sempre que possível, **divida migrations grandes em pequenas atômicas** (uma feature por migration). E quando precisar de DDL + DML junto, use `BEGIN; ... COMMIT;` explícito.

## Bug 11 — Listagem de Auth users quebrada por NULL field

**Sintoma:** Endpoint `/admin/users` retorna 500 com erro Scan.

**Causa raiz:** Bug do GoTrue (Auth do Supabase) — coluna `email_change` NULL quebra deserialização.

**Workaround:** UPDATE pra preencher campos NULL:

```sql
UPDATE auth.users SET email_change = '' WHERE email_change IS NULL;
```

Mas isso é **paliativo**. Reportar pro Supabase.

## Bug 12 — RLS quebra por causa de policy circular

**Sintoma:** Query simples retorna 0 linhas, mas você sabe que tem dados.

**Causa raiz:** Policy referencia tabela B, que tem policy referenciando tabela A, que tem policy referenciando B... loop.

**Fix:** Use função SECURITY DEFINER com `SET search_path` pra "quebrar" o loop:

```sql
CREATE FUNCTION user_has_org_access(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() AND organization_id = p_org AND status = 'active'
  );
$$;

-- Usa nas policies:
CREATE POLICY "..." ON some_table USING (user_has_org_access(organization_id));
```

## Bug 13 — Realtime subscription leak

**Sintoma:** App fica lento após algumas trocas de página.

**Causa raiz:** Subscription do Supabase Realtime não é limpa em `useEffect cleanup`.

**Fix:**

```tsx
useEffect(() => {
  const channel = supabase.channel('xyz').on(...).subscribe();
  return () => { supabase.removeChannel(channel); }; // ← cleanup obrigatório
}, []);
```

## Bug 14 — Build do Vite vaza secret via VITE_

**Sintoma:** Dev colocou `VITE_OPENAI_KEY=sk-...` no .env achando que tava OK. Build expõe.

**Causa raiz:** **Tudo com prefixo `VITE_` vai pro front**. Era pra ser `OPENAI_KEY` (sem VITE_) e usar só em Edge Function.

**Fix:** Conferir TODAS as variáveis no `.env`:
- ✅ `VITE_SUPABASE_URL` — OK no front
- ✅ `VITE_SUPABASE_ANON_KEY` — OK no front (limitada por RLS)
- ❌ `VITE_OPENAI_KEY` — NÃO. Mover pra Supabase secret.
- ❌ `VITE_STRIPE_SECRET_KEY` — NÃO. Mover pra Supabase secret.

Pre-deploy hook deve grep por padrões de chave no `dist/`.

## Bug 15 — `verify_jwt: false` esquecido em produção

**Sintoma:** Função `delete-user` tem `verify_jwt: false` (deixei pra "testar"). Produção subiu assim. Qualquer pessoa na internet pode chamar.

**Fix:** Skill `Auditor de Segurança IA` detecta isso. Ou check manual:

```bash
grep -A 1 "\[functions\." supabase/config.toml | grep -B 1 "verify_jwt = false"
```

Validar que TODA função com `false` é webhook externo legítimo.

## Padrões pra evitar bugs novos

1. **Idempotência sempre** em webhooks
2. **Critério de desempate** em ORDER BY
3. **`SET search_path`** em SECURITY DEFINER
4. **Cleanup de subscriptions**
5. **Validar input** em edge functions
6. **Prefixar variáveis VITE_/NEXT_PUBLIC_** com cuidado
7. **`verify_jwt: true` por default**
8. **Pre-deploy hooks** automatizados
