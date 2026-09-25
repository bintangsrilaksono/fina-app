import { NextRequest } from "next/server";
import { handleChatStreaming } from "@/features/ai/chat";
import { Conversation } from "@/app/types/ai";

export async function POST(request: NextRequest) {
  const { conversation, isThinking, mode } = (await request.json()) as {
    conversation: Conversation[];
    isThinking: boolean;
    mode: "general" | "personal";
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of handleChatStreaming(
          conversation,
          isThinking,
          mode,
        )) {
          const isThought = chunk.startsWith("[thought]");
          const text = isThought ? chunk.replace("[thought]", "") : chunk;
          controller.enqueue(
            encoder.encode(JSON.stringify({ thought: isThought, text }) + "\n"),
          );
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
