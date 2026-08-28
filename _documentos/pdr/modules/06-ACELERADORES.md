# Módulo 06 — Aceleradores

> Catálogo de templates, skills, prompts e guias que aluno baixa pra acelerar projetos. **Ouro do programa.**

## Tipos

| Tipo (`type`) | O que é | Como usa |
|---|---|---|
| `skill` | Skill do Claude (Capabilities) | Importa em Claude.ai |
| `prompt` | Prompt pronto pra colar no chat | Cola no ChatGPT/Claude |
| `guia` | Documentação técnica de integração | Lê e segue |
| `template` (label "Projeto") | Código completo pra clonar/integrar | Roda no Claude Code/Lovable |

## Schema

```sql
CREATE TABLE accelerators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  long_description TEXT,
  type TEXT, -- 'skill' | 'prompt' | 'guia' | 'template'
  difficulty TEXT, -- 'Iniciante' | 'Intermediário' | 'Avançado'
  setup_time TEXT,
  category TEXT, -- 'Conteúdo & Marketing' | 'Vendas & CRM' | 'Integrações' | 'Segurança & DevOps' | 'SaaS & Produtos' | 'Gestão & Estratégia'
  
  -- Visuais
  thumbnail TEXT,
  screenshots JSONB,
  video_url TEXT,
  
  -- Conteúdo
  stack JSONB, -- ["React", "Supabase", ...]
  features JSONB, -- ["Feature 1", "Feature 2"]
  prerequisites JSONB, -- [{"label":"...", "url":"..."}]
  installation_guide TEXT,
  documentation TEXT,
  troubleshooting TEXT, -- Markdown com seções ### que viram FAQ items
  env_example TEXT,
  sql_migrations TEXT,
  
  -- Distribuição
  download_url TEXT,
  lovable_remix_url TEXT,
  import_methods JSONB, -- ["claude-code", "lovable", "gpt-agent"]
  
  -- Vínculos
  related_project_id TEXT REFERENCES projects(id),
  
  -- Tags + status
  tags JSONB,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  download_count INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Páginas

### `/aceleradores` (catálogo)
- Filtros: Tipo (Skill/Prompt/Guia/Projeto), Categoria, Dificuldade
- Search
- Grid de cards: thumbnail, badges (tipo + dificuldade + "Trilha" se tem related_project), título, descrição, setup_time, métodos de import
- Click no card → `/aceleradores/:slug`

### `/aceleradores/:slug` (detalhe)
- Hero: thumbnail + título + badges + descrição curta
- **Card "Módulo vinculado"** (se `related_project_id`) logo após hero
- Vídeo (se tem)
- Pré-requisitos
- Stack
- Features (lista)
- Como usar (3 passos por método: claude-code, lovable, gpt-agent)
- Variáveis de ambiente
- SQL migrations
- Documentação
- Troubleshooting (parsea `### Pergunta` → FAQ accordion)
- Botão "Baixar ZIP" → URL do ZIP

## Componentes

```
src/components/accelerators/
├── AcceleratorCard.tsx      # Card pra grid
├── AcceleratorGrid.tsx
├── ImportMethodTabs.tsx     # Lovable / Claude Code / GPT
├── PrerequisitesList.tsx
├── TroubleshootingFAQ.tsx   # Parser de ### → accordion
└── DownloadButton.tsx       # Incrementa download_count
```

## Parser de troubleshooting

Padrão Markdown com `### `:

```markdown
## Problemas comuns

### O modal "Virar Lead" tá vazio
Suas tabelas no CRM têm nome diferente. Edite VirarLeadModal.tsx e prospeccao-virar-lead/index.ts.

### Erro "Lead sem telefone"
Lead não tem phone público. Digite manualmente no modal.
```

Parser:
```tsx
const sections = troubleshooting.split(/###\s+/).filter(Boolean);
const faqItems = sections.map(section => {
  const lines = section.trim().split('\n');
  return {
    question: lines[0]?.trim(),
    answer: lines.slice(1).join('\n').trim()
  };
});
```

## Vínculo com trilha

Acelerador → Project (trilha): `accelerators.related_project_id` (text, FK).

UI:
- **No detalhe do acelerador**: card grande "🎓 Módulo vinculado" → leva pra `/na-pratica/:project`
- **No card da listagem**: badge "🎓 Trilha" se `related_project_id` existir
- **Na página da trilha**: card "📦 Acelerador disponível" com link

## Rotina ao publicar acelerador novo (4 passos automáticos)

1. **Thumbnail**: gera via Gemini 3 Pro Image (mesma função que gera thumb de aulas)
2. **Novidade pinada**: INSERT em `community_questions` (channel `novidades`, is_pinned=true)
3. **WhatsApp**: dispara mensagem no grupo principal via UAZAPI com link
4. **POST_LINKS**: adicionar id do post de Novidade no `POST_LINKS` do componente NovidadesTab pra ter botão "Ir para X"

## RLS

```sql
ALTER TABLE accelerators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view published accelerators" ON accelerators
  FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true AND is_active = true);

CREATE POLICY "Admins manage all accelerators" ON accelerators
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

## Storage de ZIPs

Buckets:
- `public/downloads/<slug>.zip` → arquivos públicos pra download direto
- Tamanho máx 100MB no Supabase Storage free tier
- Servir via CDN do Netlify (mais rápido)

## Skill especial: Auditor de Segurança

Skill incluída por padrão pra todo aluno:
- Detecta service_role exposta, RLS faltando, chaves no front, deps com CVE
- Modo interativo + modo pre-deploy-check (15s)
- Instala hooks git pre-push pra bloquear deploy com vulnerabilidade
- Inspirado em OWASP Top 10 + CWE Top 25

Detalhes em `operacao/SEGURANCA.md`.

## Checklist

- [ ] Schema `accelerators`
- [ ] Página `/aceleradores` com filtros + search
- [ ] Página `/aceleradores/:slug` com tabs
- [ ] Parser de troubleshooting (### → FAQ)
- [ ] Card "Módulo vinculado" + badge "Trilha"
- [ ] Vínculo trilha ↔ acelerador (ambas direções)
- [ ] Rotina automática de publicação (thumb + Novidade + WhatsApp + POST_LINKS)

## Próximo

`07-ENCONTROS-AO-VIVO.md`
