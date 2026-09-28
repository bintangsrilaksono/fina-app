"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { handleWizardInput, handleWizardTools } from "@/features/ai/wizard";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2Icon,
  MicIcon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { KeyboardEvent, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Markdown from "react-markdown";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export default function WizardInput({ refetch }: { refetch: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: handleWizardTools,
    onSuccess: (response) => {
      toast.success(
        <div className="response-ai w-full!">
          <Markdown>{response}</Markdown>
        </div>,
      );
      refetch();
      form.reset();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process your request",
      );
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append("type", "text");
    formData.append("file", "");
    formData.append("request", data.message);
    mutate(formData);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(form.getValues());
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("type", "audio");
        formData.append("request", "");
        formData.append("file", audioBlob);
        mutate(formData);

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Failed to access media recorder");
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const isText = form.watch("message") !== "";

  return (
    <Card className="w-full p-0 border-primary/20">
      <CardContent className="pr-2">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-center gap-2"
        >
          <div className="text-primary">
            <SparklesIcon className="size-5" />
          </div>
          <Controller
            control={form.control}
            name="message"
            render={({ field }) => (
              <Field>
                <input
                  {...field}
                  id="form-message"
                  placeholder={
                    isRecording
                      ? "Listening..."
                      : isPending && !field.value
                        ? "Processing your request..."
                        : "Manage your transaction here"
                  }
                  autoComplete="off"
                  className="h-14 focus:outline-none"
                  onKeyDown={handleKeyDown}
                  disabled={isPending}
                />
              </Field>
            )}
          />
          <Button
            type={isText ? "submit" : "button"}
            size="icon"
            variant="ghost"
            disabled={isPending}
            onClick={
              !isText
                ? isRecording
                  ? stopRecording
                  : startRecording
                : undefined
            }
          >
            {isPending ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : isText ? (
              <SendIcon className="size-5" />
            ) : isRecording ? (
              <SquareIcon className="text-red-500 fill-red-500 size-5 animate-pulse" />
            ) : (
              <MicIcon className="size-5" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
