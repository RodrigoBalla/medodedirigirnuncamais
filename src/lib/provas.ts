import { supabase } from "@/integrations/supabase/client";

// ─── provas.ts ────────────────────────────────────────────────────────────────
// Camada de acesso da feature "Pesquisa de compra + Provas por aula".
// As tabelas/RPCs novas ainda não estão nos types gerados do Supabase, então
// usamos um cast localizado (sb) — as respostas são tipadas manualmente aqui.
// A resposta certa das provas NUNCA vem pro cliente (get_lesson_quiz omite).
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface SurveyQuestion {
  id: string;
  order_index: number;
  question: string;
  options: string[];
  allow_other: boolean;
}

export interface QuizQuestion {
  id: string;
  order_index: number;
  question: string;
  options: string[];
}

export interface LearningState {
  survey_done: boolean;
  quizzed_lessons: string[];
  lessons_with_quiz: string[];
  my_score: number | null;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
}

export async function getPurchaseSurvey(): Promise<SurveyQuestion[]> {
  const { data, error } = await sb.rpc("get_purchase_survey");
  if (error) throw error;
  return (data ?? []) as SurveyQuestion[];
}

export async function submitPurchaseSurvey(answers: Record<string, string>): Promise<void> {
  const { error } = await sb.rpc("submit_purchase_survey", { p_answers: answers });
  if (error) throw error;
}

export async function getLessonQuiz(lessonId: string): Promise<QuizQuestion[]> {
  const { data, error } = await sb.rpc("get_lesson_quiz", { p_lesson_id: lessonId });
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

export async function submitQuiz(
  lessonId: string,
  answers: Record<string, number>,
): Promise<QuizResult> {
  const { data, error } = await sb.rpc("submit_quiz", { p_lesson_id: lessonId, p_answers: answers });
  if (error) throw error;
  return data as QuizResult;
}

export async function getLearningState(): Promise<LearningState> {
  const { data, error } = await sb.rpc("get_my_learning_state");
  if (error) throw error;
  return (data ?? { survey_done: false, quizzed_lessons: [], lessons_with_quiz: [], my_score: null }) as LearningState;
}

// ── Admin ──
export interface AproveitamentoStudent {
  user_id: string;
  name: string;
  email: string;
  score: number | null;
  quizzes_done: number;
  total_correct: number;
  total_questions: number;
  last_activity: string | null;
}
export interface AproveitamentoData {
  students: AproveitamentoStudent[];
  lessons_with_quiz: number;
  total_questions: number;
}

export async function adminAproveitamento(): Promise<AproveitamentoData> {
  const { data, error } = await sb.rpc("admin_aproveitamento");
  if (error) throw error;
  return data as AproveitamentoData;
}

export interface SurveySummary {
  total_responses: number;
  questions: { id: string; order_index: number; question: string; options: string[]; allow_other: boolean }[];
  responses: { name: string; email: string; answers: Record<string, string>; when: string }[];
}

export async function adminPurchaseSurveySummary(): Promise<SurveySummary> {
  const { data, error } = await sb.rpc("admin_purchase_survey_summary");
  if (error) throw error;
  return data as SurveySummary;
}

export interface StudentQuizDetail {
  lesson: string;
  order: number;
  correct: number;
  total: number;
  when: string;
  answers: Record<string, number>;
}
export async function adminStudentQuizDetail(userId: string): Promise<StudentQuizDetail[]> {
  const { data, error } = await sb.rpc("admin_student_quiz_detail", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as StudentQuizDetail[];
}
