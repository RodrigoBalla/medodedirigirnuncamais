# Princípios de Design

## 1. Clareza > beleza

Beleza é consequência da clareza, não objetivo. Um aluno olha a tela e em 3 segundos sabe:
- Onde estou?
- O que devo fazer?
- O que significa cada elemento?

## 2. Um CTA por contexto

Cada tela tem **1 ação principal**. Outras opções existem mas com hierarquia visual menor.

❌ 10 botões do mesmo tamanho
✅ 1 botão grande "Continuar" + 2 botões pequenos secundários

## 3. Estados visíveis

Aluno sempre sabe:
- O que está fazendo (loading)
- O que aconteceu (success/error)
- O que falta (% de progresso)

## 4. Gates explícitos, não escondidos

Etapa bloqueada deve **aparecer com cadeado**, não sumir. O aluno entende o caminho completo.

## 5. Linguagem humana > jargão

"Sua chave-mestra está exposta" antes de "Service role leak". Termo técnico vem em destaque depois pra ele aprender.

## 6. Mobile-first quando possível

Aluno pode estar no ônibus. Layout deve fluir. Mas em **admin panel pode ser desktop-first** (CS opera no PC).

## 7. Confirmação pra ações destrutivas

Antes de deletar, abandonar jornada, sair de organização: modal "Tem certeza?" com explicação do impacto.

## 8. Latência percebida

90% dos casos não precisam ser "instantâneos" se a UI dá feedback:
- Skeleton durante load
- Optimistic updates
- "Salvando..." em vez de tela travada

## Design tokens (recomendados)

### Cores (estilo PAIN — adapte)

```css
--ink: #0c0c0e;          /* fundo principal (dark) */
--parchment: #f8f6f1;    /* texto principal off-white */
--amber: #c8952e;        /* primary, CTAs */
--amber-light: #e4b964;  /* hover */
--sage: #7a9182;         /* secondary, success */
--error: #c4453a;
--success: #3a8a5c;
--border: rgba(248,246,241,0.06);
--border-hover: rgba(248,246,241,0.1);
```

### Typography

- **Display** (h1, h2): Instrument Serif (cinematográfico)
- **Body**: DM Sans (legível, neutro)
- **Mono** (código): JetBrains Mono ou Geist Mono

### Spacing (Tailwind)

- Padding interno cards: `p-6` desktop, `p-4` mobile
- Gap entre cards: `gap-6` desktop, `gap-4` mobile
- Container max-width: `max-w-7xl`

### Shadows / glows

Use shadow + glow sutil pra dar profundidade:

```css
shadow-lg shadow-amber-500/10  /* elementos destacados */
ring-2 ring-amber-500/30        /* foco/seleção */
```

### Animação

- Hover: `transition-all duration-200`
- Entrada: `animate-fade-in` (Framer Motion: `opacity 0 → 1, y 20 → 0`)
- Pulse pra "novo": `animate-pulse`

## Padrões de componente

### Card padrão

```tsx
<Card className="border-border/50 hover:border-primary/40 transition-all hover:shadow-lg">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Badge de severidade (segurança)

```tsx
🚨 CRÍTICO  → bg-red-500 text-white
⚠️ CUIDADO  → bg-amber-500 text-amber-950
💡 DICA     → bg-emerald-500 text-white
✅ OK       → bg-green-500 text-white
```

### Empty state

Sempre com ilustração/ícone grande + mensagem amigável + CTA:

```tsx
<div className="text-center py-12">
  <Search className="w-12 h-12 mx-auto opacity-50 mb-4" />
  <p className="text-lg">Nenhum projeto encontrado</p>
  <p className="text-sm text-muted-foreground">Tente outro termo</p>
</div>
```

### Loading skeleton

```tsx
<div className="grid gap-4">
  {[...Array(3)].map((_, i) => (
    <Skeleton key={i} className="h-24 w-full" />
  ))}
</div>
```

## Anti-patterns

❌ **Modal dentro de modal** — confuso. Use drawer ou nova rota.
❌ **Tooltip pra explicar erro grave** — use mensagem inline ou modal.
❌ **Cor sozinha pra status** — sempre acompanhe com ícone/texto (acessibilidade).
❌ **Animação infinita em fundo** — distrai.
❌ **Toast pra ação importante** — toast é pra info passageira, não pra erro crítico.
