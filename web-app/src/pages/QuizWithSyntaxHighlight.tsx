import { CodeSyntaxScope } from "@/components/CodeSyntaxScope";
import Quiz from "@/pages/Quiz";

export default function QuizWithSyntaxHighlight() {
  return (
    <CodeSyntaxScope>
      <Quiz />
    </CodeSyntaxScope>
  );
}
