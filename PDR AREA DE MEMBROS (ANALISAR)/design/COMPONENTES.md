# Componentes Essenciais

> Lista do que precisa existir. Use shadcn/ui como base.

## shadcn/ui (instalar via CLI)

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog input form label select textarea badge separator avatar dropdown-menu accordion tabs toast table alert tooltip progress skeleton sheet
```

## Custom components

```
src/components/
├── ui/                          # shadcn (não tocar)
│
├── layout/
│   ├── AppSidebar.tsx           # Sidebar principal (desktop)
│   ├── MobileTabBar.tsx         # Tab bar inferior (mobile)
│   ├── Header.tsx
│   └── Breadcrumbs.tsx
│
├── auth/
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   ├── ResetPasswordForm.tsx
│   └── ProtectedRoute.tsx
│
├── journey/
│   ├── JourneyHeader.tsx        # saudação + countdown + equipe
│   ├── GoalsPanel.tsx           # meta 30d/90d/gargalo
│   ├── WeeklyReview.tsx         # plano da semana
│   ├── JourneyRoadmap.tsx       # 7 etapas horizontal
│   ├── JourneyCurrentStep.tsx   # step atual em destaque
│   ├── JourneyBentoGrid.tsx     # grid de cards
│   ├── ContextualNudge.tsx      # frase contextual
│   ├── StackPanel.tsx           # ferramentas progressivas
│   ├── CallRequestModal.tsx     # solicitar call
│   ├── CsContactButton.tsx      # botão pra CS/Tech
│   ├── TaskList.tsx             # lista de tasks
│   ├── TaskCard.tsx
│   ├── EvidenceUploadModal.tsx
│   └── PreJourneyState.tsx      # state antes de onboarding
│
├── lesson/
│   ├── LessonCard.tsx
│   ├── LessonGrid.tsx
│   ├── VideoPlayer.tsx          # HLS
│   ├── LessonSteps.tsx          # com timestamps clicáveis
│   ├── LessonFAQ.tsx
│   ├── LessonTranscript.tsx
│   ├── LessonMaterials.tsx      # links + downloads
│   └── LessonTutorChat.tsx      # IA tutor
│
├── community/
│   ├── ChannelTabs.tsx
│   ├── PostCard.tsx
│   ├── PostDetail.tsx
│   ├── AnswerThread.tsx
│   ├── ReactionPicker.tsx
│   ├── NewPostDialog.tsx
│   └── NovidadeCard.tsx
│
├── accelerators/
│   ├── AcceleratorCard.tsx
│   ├── AcceleratorGrid.tsx
│   ├── ImportMethodTabs.tsx
│   ├── PrerequisitesList.tsx
│   ├── TroubleshootingFAQ.tsx
│   └── DownloadButton.tsx
│
├── live-meetings/
│   ├── MeetingCard.tsx
│   ├── MeetingPlayer.tsx
│   └── ScheduleCallModal.tsx
│
├── admin/
│   ├── ImpersonateButton.tsx
│   ├── OrgPicker.tsx
│   ├── UsersList.tsx
│   ├── JourneyManager.tsx
│   ├── ContentEditor.tsx
│   └── MetricsCharts.tsx
│
├── shared/
│   ├── FavoriteButton.tsx
│   ├── EmptyState.tsx
│   ├── LoadingSkeleton.tsx
│   ├── NewBadge.tsx
│   └── SeverityBadge.tsx
```

## Hooks essenciais

```
src/hooks/
├── useAuth.ts
├── useUserOrg.ts
├── useUserRole.ts
├── useJourney.ts
├── useStudyMetrics.ts
├── useLessonProgress.ts
├── useNextMentoria.ts
├── useStackTools.ts
├── useCsInteractions.ts
├── useVictories.ts
├── useAchievements.ts
├── useNudgeData.ts
├── useUnreadCounts.ts
├── useNotifications.ts
├── useCommunityFeed.ts
├── useAccelerators.ts
└── useImpersonate.ts
```

## Layouts

### App Layout (logado)

```tsx
function AppLayout() {
  return (
    <div className="flex h-screen-safe">
      <AppSidebar className="hidden md:flex w-64" />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <Breadcrumbs />
        <Outlet />
      </main>
      <MobileTabBar className="md:hidden fixed bottom-0 left-0 right-0" />
    </div>
  );
}
```

### Admin Layout

```tsx
function AdminLayout() {
  const { isAdmin } = useUserRole();
  if (!isAdmin) return <Navigate to="/" />;
  
  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        <Outlet />
      </main>
    </div>
  );
}
```

## Componentes de animação (Framer Motion)

```tsx
import { motion } from 'framer-motion';

// Fade-in
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>...</motion.div>

// Stagger children
<motion.div variants={container} initial="hidden" animate="visible">
  {items.map((item, i) => (
    <motion.div key={i} variants={item}>...</motion.div>
  ))}
</motion.div>
```

## Formulários (react-hook-form + zod)

```tsx
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
```

## Toast (sonner)

```tsx
import { toast } from 'sonner';

toast.success('Aula marcada como concluída');
toast.error('Não foi possível salvar');
toast.loading('Salvando...');
```

## Diálogo de confirmação (padrão)

```tsx
function ConfirmDialog({ open, onConfirm, onCancel, title, description, destructive }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
