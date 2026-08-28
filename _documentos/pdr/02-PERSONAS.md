# 02 — Personas

> Quem usa a plataforma e o que cada um precisa fazer no dia a dia.

## 1. 🎓 Aluno (executor principal)

### Quem é
- Dono de PME, infoprodutor, freelancer ou colaborador de empresa-cliente
- Pagou pra entrar no programa OU foi convidado pela empresa que pagou
- Tem objetivo concreto (ex: "lançar SaaS em 90 dias", "automatizar prospecção")
- **Não é dev sênior.** Pode ser dev iniciante ou não-técnico
- Tempo limitado (5-15h/semana)
- Cético com "mais uma plataforma de curso"

### O que ele precisa
- Saber **o que fazer hoje** (sem decidir)
- Entender **por que isso importa** pro objetivo dele
- Acessar conteúdo + ferramentas + acompanhamento humano em 1 lugar
- **Falar com humano** quando travar (não com bot)
- Ver progresso real (não vanity metrics)

### Páginas que usa
- `/` (home) — call-to-action da etapa atual
- `/minha-jornada` — visão da jornada completa
- `/trilhas/:slug` — módulos de conteúdo
- `/trilhas/:slug/aula/:id` — player com tutor IA
- `/aceleradores` — catálogo de templates
- `/encontros-ao-vivo` — gravações de mentorias
- `/comunidade/*` — discussões com outros alunos
- `/perfil` — perfil + configurações

### Sinais de sucesso
- Acessa 3+ vezes por semana
- Completa task da etapa atual
- Marca vitória registrada
- Termina objetivo de 30 dias

### Sinais de risco (CS deve agir)
- Não acessa há 7+ dias
- Travado na mesma etapa há 5+ dias
- Não respondeu última mensagem da CS
- Onboarding completo mas zero tasks tocadas

## 2. 💚 CS (Customer Success)

### Quem é
- Pessoa do time que acompanha alunos no dia a dia
- Não é técnica (não escreve código)
- WhatsApp 90% do tempo aberto pros alunos
- Foco: garantir que aluno **execute**, não que consuma conteúdo

### O que faz
- Recebe notificação de aluno travado
- Manda mensagem proativa de check-in semanal
- Atende solicitações de contato
- Registra histórico de cada conversa
- Aprova passos que precisam de validação humana (`cs_validation` em tasks)
- Dispara mentoria com Suporte Técnico quando trava em problema técnico

### Páginas que usa
- `/admin/journeys` — vê todas as jornadas, filtra travadas
- `/admin/users/:id` — perfil do aluno + histórico CS
- WhatsApp (não está dentro da plataforma)
- Painel de conversas (opcional, pode ser CRM externo)

### Sinais de sucesso
- Taxa de execução do programa subindo
- Tempo médio até resolução de bloqueio < 24h
- NPS do aluno alto

## 3. 🛠️ Suporte Técnico

### Quem é
- Pessoa do time com background dev (resolve problema técnico do aluno)
- Calls de mentoria 30-60min pra destravar implementação
- Acessa código do aluno (com permissão), tira screenshare

### O que faz
- Recebe solicitação via "Suporte com Luiz" (botão da plataforma)
- Agenda call (modal mostra slots disponíveis)
- Atende call, resolve, marca como completa
- Adiciona stack tools recomendadas pra aquele aluno (`journey_stack_tools`)
- Cria conteúdo técnico avulso (docs, vídeos curtos) quando padrão se repete

### Páginas que usa
- `/admin/calls` — calendário de calls
- `/admin/users/:id` — vê stack tools, jornada
- Zoom (call em si)

## 4. 👑 Admin (você, fundador/operador)

### Quem é
- Pessoa que opera o programa todo
- Decisões de produto, conteúdo, regras
- Vê métricas de saúde geral

### O que faz
- Cria/edita conteúdo (trilhas, aulas, aceleradores)
- Cria/aprova organizações
- Edita jornadas-template e regras
- Vê métricas: NPS, taxa de execução, churn
- Onboarding de novos clientes empresa
- Comunicação geral (Novidades, WhatsApp grupo)

### Páginas que usa
- `/admin/users` — todos usuários
- `/admin/organizations` — todas orgs
- `/admin/journeys` — todas jornadas
- `/admin/content` — conteúdo (trilhas, aulas, aceleradores)
- `/admin/calls` — encontros ao vivo
- `/admin/metrics` — dashboard

### Capacidades especiais
- **Impersonate** — logar como qualquer aluno pra ver o que ele vê
- **Edição em massa** — adicionar mesmo acelerador a várias orgs
- **Override de gates** — desbloquear etapa pra aluno específico (caso edge)
- **Reset de jornada** — recomeçar do zero sem perder histórico

## Permissões matriz

| Ação | Aluno | CS | Tech | Admin |
|---|:---:|:---:|:---:|:---:|
| Ver própria jornada | ✅ | — | — | ✅ |
| Ver jornada de outros | ❌ | ✅ | ✅ | ✅ |
| Marcar task como completa (própria) | ✅ | — | — | ✅ |
| Marcar task como completa (de outro) | ❌ | ✅ (`cs_validation`) | ✅ (`cs_validation`) | ✅ |
| Adicionar stack tool | — | ✅ | ✅ | ✅ |
| Adicionar `cs_interaction` | — | ✅ | ✅ | ✅ |
| Convidar membro pra org | ✅ (sponsor) | ❌ | ❌ | ✅ |
| Criar nova org | ❌ | ❌ | ❌ | ✅ |
| Editar conteúdo (trilha/aula) | ❌ | ❌ | ❌ | ✅ |
| Impersonate | ❌ | ❌ | ❌ | ✅ |
| Acessar admin panel | ❌ | ✅ (subset) | ✅ (subset) | ✅ |

## Implementação técnica

### Identificação de papel

```sql
-- profiles.is_admin = true → admin
-- cs_assignments → CS responsável por org X
-- organization_members.role → sponsor / executor / viewer
```

### Função de autorização (RPC SECURITY DEFINER)

```sql
CREATE FUNCTION user_role_in_org(p_org uuid)
RETURNS text
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT 'admin' FROM profiles WHERE id = auth.uid() AND is_admin = true),
    (SELECT role FROM organization_members WHERE user_id = auth.uid() AND organization_id = p_org AND status = 'active'),
    'none'
  );
$$;
```

Usar em RLS policies: `WHERE user_role_in_org(organization_id) IN ('sponsor', 'executor', 'admin')`.

### Componentes condicionais no front

```tsx
const { isAdmin, role } = useUserRole();

{isAdmin && <ImpersonateButton />}
{role === 'sponsor' && <InviteMemberDialog />}
{(role === 'sponsor' || role === 'executor') && <CompleteTaskButton />}
```

## Próximo

Lê `03-JORNADA-USUARIO.md` — como cada persona vive a plataforma do começo ao fim.
