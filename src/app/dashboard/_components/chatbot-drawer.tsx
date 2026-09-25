"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { BotIcon, ChevronDownIcon, EllipsisIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ChatbotTextarea from "./chatbot-textarea";
import { useMutation } from "@tanstack/react-query";
import Markdown from "react-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Conversation } from "@/app/types/ai";

export default function ChatbotDrawer() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [conversation, setConversation] = useState<Conversation[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [mode, setMode] = useState<"general" | "personal">("general");

  const { mutate: handleChatMutation, isPending } = useMutation({
    mutationFn: async ({ isThinking }: { isThinking: boolean }) => {
      setConversation((prev) => [
        ...prev,
        isThinking
          ? { role: "model", parts: [{ thought: true, text: "" }, { text: "" }] }
          : { role: "model", parts: [{ text: "" }] },
      ]);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation, isThinking, mode }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to get response from AI Advisor");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const { thought, text } = JSON.parse(line) as {
            thought: boolean;
            text: string;
          };

          setConversation((prev) => {
            const newConversation = [...prev];
            const lastIndex = newConversation.length - 1;
            const parts = newConversation[lastIndex].parts;

            newConversation[lastIndex] = isThinking
              ? {
                  ...newConversation[lastIndex],
                  parts: [
                    {
                      ...parts[0],
                      text: thought ? parts[0].text + text : parts[0].text,
                    },
                    {
                      text: !thought ? parts[1].text + text : parts[1].text,
                    },
                  ],
                }
              : {
                  ...newConversation[lastIndex],
                  parts: [{ text: parts[0].text + text }],
                };
            return newConversation;
          });
        }
      }
    },
    onError: (error) => {
      const botMessage = {
        role: "model",
        parts: [{ text: "Terjadi kesalahan: " + error.message }],
      };
      setConversation((prev) => [...prev, botMessage]);
    },
  });

  function sendMessage(message: string) {
    const newMessage = {
      role: "user",
      parts: [{ text: message }],
    };
    setConversation((prev) => [...prev, newMessage]);
    handleChatMutation({ isThinking });
  }

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current?.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [conversation]);

  return (
    <Drawer direction="right" modal={false}>
      <DrawerTrigger className="fixed bottom-4 right-4" asChild>
        <Button
          className="rounded-full size-14"
          size="icon-lg"
          variant="outline"
        >
          <BotIcon className="size-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-screen! md:w-110!">
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle className="font-bold text-primary">
              AI Financial Advisor
            </DrawerTitle>
            <DrawerDescription>
              Get personalized financial advice.
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="icon">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="h-full px-4 overflow-y-auto no-scrollbar">
          {conversation.length > 0 ? (
            <div
              ref={chatRef}
              className="flex flex-col h-full gap-8 overflow-x-hidden overflow-y-auto no-scrollbar"
            >
              {conversation.map((message, index) => (
                <div
                  key={`conversation-${index}`}
                  className={cn(
                    "flex flex-col gap-2",
                    message.role === "model" ? "items-start" : "items-end",
                  )}
                >
                  <div
                    className={cn("flex flex-col w-full", {
                      "bg-primary/20 text-primary px-5 py-2 rounded-3xl rounded-br-md w-fit max-w-3/4":
                        message.role === "user",
                    })}
                  >
                    {message.role === "model" && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <BotIcon />
                        AI Advisor
                      </div>
                    )}
                    {message.role === "model" ? (
                      <div className="response-ai">
                        {message.parts.map((part, indexPart) => (
                          <div key={`response-ai-${index}-${indexPart}`}>
                            {part.thought ? (
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost">
                                    Tampilkan alur berpikir
                                    <ChevronDownIcon />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="pl-2 ml-4 border-l">
                                    <Markdown>{part.text}</Markdown>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ) : (
                              <Markdown>{part.text}</Markdown>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      message.parts[0].text
                    )}
                  </div>
                </div>
              ))}
              {isPending && (
                <div className="flex items-center animate-pulse">
                  <EllipsisIcon className="size-8 text-primary/50" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <h2 className="text-3xl font-bold text-primary">Hello There</h2>
              <h4 className="text-xl">What can I help you?</h4>
            </div>
          )}
        </div>
        <DrawerFooter>
          <ChatbotTextarea
            isThinking={isThinking}
            setIsThinking={setIsThinking}
            sendMessage={sendMessage}
            mode={mode}
            setMode={setMode}
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
