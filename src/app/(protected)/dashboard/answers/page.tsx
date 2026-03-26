import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCanonicalQuestionsWithAnswers, getOrphanAnswers } from "@/lib/data/answer-library";
import { AnswerLibrary } from "@/components/answers/answer-library";
import { AddQuestionDialog } from "@/components/answers/add-question-dialog";

export const metadata: Metadata = {
  title: "Answer Library | Job Platform",
  description: "Manage your screening question answers",
};

export default async function AnswersPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const [questions, orphanAnswers] = await Promise.all([
    getCanonicalQuestionsWithAnswers(authData.user.id),
    getOrphanAnswers(authData.user.id),
  ]);

  const totalAnswers = questions.reduce(
    (sum, q) => sum + q.screening_answers.length,
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Answer Library</h1>
          <p className="text-muted-foreground mt-2">
            {questions.length === 0
              ? "Build your personal knowledge base of screening question answers."
              : `${questions.length} ${questions.length === 1 ? "question" : "questions"}, ${totalAnswers} ${totalAnswers === 1 ? "answer" : "answers"}`}
          </p>
        </div>
        <AddQuestionDialog />
      </div>

      <AnswerLibrary questions={questions} orphanAnswers={orphanAnswers} />
    </div>
  );
}
