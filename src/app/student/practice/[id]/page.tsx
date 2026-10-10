import { getDb } from "@/lib/db";
import { requireStudentPage } from "@/lib/auth/student";
import Chat from "@/components/student/Chat";
import type { Concept, Conversation } from "@/lib/types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { studentId } = await requireStudentPage();
  const db = await getDb();

  const conversation = await db
    .collection<Conversation>("conversations")
    .findOne({ id, studentId });
  if (!conversation) {
    return (
      <main className="mx-auto w-full max-w-md p-4">
        <p>Conversation not found.</p>
      </main>
    );
  }

  const concept = await db
    .collection<Concept>("concepts")
    .findOne({ id: conversation.conceptId });

  const initialTurns = conversation.turns.map((t) => ({
    role: t.role,
    text: t.text,
  }));

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <Chat
        conversationId={conversation.id}
        conceptTitle={concept?.title ?? "Concept"}
        initialTurns={initialTurns}
      />
    </main>
  );
}
