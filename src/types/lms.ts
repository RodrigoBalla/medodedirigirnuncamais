export interface Product {
  id: string;
  title: string;
  description: string;
  image_url: string;
  status: string;
  created_at: string;
}

export interface Module {
  id: string;
  product_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: string;
  video_url: string;
  order_index: number;
  created_at: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  description: string;
}

export interface LessonChallenge {
  id: string;
  lesson_id: string;
  question_text: string;
  created_at: string;
  options?: ChallengeOption[];
}

export interface ChallengeOption {
  id: string;
  challenge_id: string;
  option_text: string;
  is_correct: boolean;
  destination_video_url: string | null;
  created_at: string;
}
