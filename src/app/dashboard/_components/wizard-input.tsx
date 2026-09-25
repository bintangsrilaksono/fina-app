"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { handleWizardInput, handleWizardTools } from "@/features/ai/wizard";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon, SendIcon, SparklesIcon } from "lucide-react";
import { KeyboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export default function WizardInput({ refetch }: { refetch: () => void }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: handleWizardTools,
    onSuccess: (response) => {
      toast.success(response);
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
    mutate(data.message);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(form.getValues());
    }
  }
  return (
    <Card className="w-full border-primary/20 p-0">
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
                  placeholder="Write your transaction here"
                  autoComplete="off"
                  className="h-14 focus:outline-none"
                  onKeyDown={handleKeyDown}
                  disabled={isPending}
                />
              </Field>
            )}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : (
              <SendIcon className="size-5" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
