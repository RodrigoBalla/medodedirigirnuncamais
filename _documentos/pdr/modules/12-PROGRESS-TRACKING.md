# Módulo 12 — Progress Tracking

> Tracking real de progresso (% de conteúdo, tempo, tasks, vitórias) — não vanity metrics.

## Princípios

1. **Tracking via observação passiva** — não pede pra usuário marcar
2. **Tolerante a desvio** — aluno fechou navegador, perdeu conexão, tudo bem
3. **Marca completed cedo** — 5min antes do fim ou 95% (não exige ver até último segundo)
4. **Sync automático** — tasks marcam quando aulas são vistas

## Tracking de aula

```typescript
videoElement.addEventListener('timeupdate', () => {
  if (Date.now() - lastUpdate < 10000) return; // throttle 10s
  lastUpdate = Date.now();
  
  const progress = video.currentTime / video.duration;
  const remaining = video.duration - video.currentTime;
  const shouldComplete = video.duration > 0 && (remaining <= 300 || progress >= 0.95);
  
  await supabase.from('user_lesson_progress').upsert({
    user_id: userId,
    lesson_id: lessonId,
    last_watched_timestamp: Math.floor(video.currentTime),
    completed: shouldComplete || alreadyCompleted,
    completed_at: shouldComplete && !alreadyCompleted ? new Date().toISOString() : undefined,
    watch_count: existingProgress ? existingProgress.watch_count + (firstPlay ? 1 : 0) : 1,
  });
});
```

## Botão manual "Marcar como concluída"

Pra casos onde aluno não viu vídeo (já sabe o conteúdo) ou track falhou:

```tsx
<Button onClick={async () => {
  await supabase.from('user_lesson_progress').upsert({
    user_id, lesson_id, completed: true, completed_at: new Date().toISOString()
  });
}}>Marcar como concluída</Button>
```

## Sync automático aulas → tasks

Quando aluno completa aulas, task da mission auto-marca:

```typescript
// Em useJourneyData hook (roda quando carrega /minha-jornada)
async function syncLessonProgressWithTasks(userId: string, journeyId: string) {
  const tracks = await getJourneyTracks(journeyId);
  
  for (const track of tracks) {
    const totalLessons = await countLessons(track.project_id);
    const completedLessons = await countCompletedLessons(userId, track.project_id);
    
    if (totalLessons > 0 && completedLessons === totalLessons) {
      // Task da mission que cita esse projeto auto-marca
      const taskTitlePattern = `%${track.projects.title}%`;
      await supabase.from('mission_tasks')
        .update({ completed_at: new Date().toISOString() })
        .ilike('title', taskTitlePattern)
        .eq('mission.journey_id', journeyId)
        .is('completed_at', null);
    }
  }
}
```

## Tipos de validação de task

`mission_tasks.validation_type`:

### `self_check`
- Aluno marca/desmarca livremente
- Sem evidência exigida
- Para: assistir aulas, configurar tools, ler material

### `evidence_required`
- Aluno cola URL ou screenshot
- Mostra modal de evidência ao tentar marcar
- Salva em `evidence_url` + `evidence_note`
- Para: deploy, código, demonstração concreta

### `cs_validation`
- Aluno NÃO marca direto
- CS recebe notificação e valida
- Aluno só vê quando `validated_at` preenchido
- Para: call concluída, apresentação final

## Métricas calculadas

### Study Metrics (mostradas no card "Seu Programa")

```typescript
async function fetchStudyMetrics(userId: string, projectIds: string[]) {
  // Tempo total + assistido
  const lessons = await getLessons(projectIds);
  const completed = await getCompletedLessons(userId, projectIds);
  
  const totalMinutes = lessons.reduce((sum, l) => sum + parseDuration(l.duration), 0);
  const completedMinutes = completed.reduce((sum, l) => sum + parseDuration(l.duration), 0);
  
  // Pace (aulas/semana)
  const dates = completed.map(l => new Date(l.completed_at).getTime()).sort();
  let lessonsPerWeek = 0;
  if (dates.length >= 2) {
    const weeks = Math.max(1, (dates[dates.length-1] - dates[0]) / (7 * 86400000));
    lessonsPerWeek = Math.round((dates.length / weeks) * 10) / 10;
  }
  
  // Próxima aula
  const nextLesson = lessons.find(l => !completedIds.has(l.id));
  
  // Estimativa de conclusão
  const remaining = lessons.length - completed.length;
  const weeksToFinish = lessonsPerWeek > 0 ? Math.ceil(remaining / lessonsPerWeek) : null;
  
  return { totalMinutes, completedMinutes, lessonsPerWeek, nextLesson, weeksToFinish };
}
```

⚠️ **Order matters**: ordenar pela ordem do array `projectIds` recebido (não alfabético) pra que `nextLesson` seja a primeira do Starter (não Builder).

## Vitórias (`user_victories`)

Aluno registra vitórias concretas durante a jornada:

```sql
CREATE TABLE user_victories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  description TEXT NOT NULL, -- ex: "Lancei agente. Captou 47 leads em 3 dias."
  metric TEXT, -- ex: "47 leads"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

UI: card "Suas vitórias" no bento grid da jornada com botão "+ Registrar".

## Achievements (gamificação leve)

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  key TEXT NOT NULL, -- 'first_lesson', 'starter_complete', '7_day_streak', etc
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, journey_id, key)
);
```

Trigger no banco desbloqueia achievements automaticamente:

```sql
CREATE FUNCTION unlock_first_lesson_achievement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed AND OLD.completed IS DISTINCT FROM NEW.completed THEN
    INSERT INTO achievements (user_id, journey_id, key, title, description, icon)
    SELECT NEW.user_id, uj.id, 'first_lesson', 'Primeira aula concluída', 'Você assistiu sua primeira aula!', '🎉'
    FROM user_journeys uj
    JOIN organization_members om ON om.organization_id = uj.organization_id
    WHERE om.user_id = NEW.user_id AND uj.is_active = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

⚠️ Use **com moderação**. Gamificação artificial sem propósito vira ruído.

## User State Log (saúde da jornada)

```sql
CREATE TYPE user_state AS ENUM ('active', 'delayed', 'stuck', 'inactive', 'accelerated');

CREATE TABLE user_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  state user_state NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Cron diário calcula state de cada journey:
- `accelerated` — completando antes do prazo
- `active` — completando no ritmo
- `delayed` — atrasado mas progredindo
- `stuck` — sem progresso há 5+ dias
- `inactive` — sem progresso há 14+ dias

CS prioriza atendimento por state (`stuck` e `inactive` primeiro).

## RLS

```sql
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_victories ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_state_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress" ON user_lesson_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own victories" ON user_victories FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users view own achievements" ON achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Members view own state" ON user_state_log FOR SELECT USING (
  journey_id IN (SELECT id FROM user_journeys WHERE organization_id IN (SELECT current_user_orgs()))
);
```

## Checklist

- [ ] Tracking de aula com 5min/95% threshold
- [ ] Botão manual "Marcar como concluída"
- [ ] Sync automático aulas → tasks
- [ ] 3 tipos de validation_type implementados
- [ ] Schema user_victories + UI de registro
- [ ] Achievements (mínimo essencial — não exagere)
- [ ] User state log + cron diário
- [ ] Study metrics no card "Seu Programa"

## Próximo

`13-INTEGRACOES.md`
