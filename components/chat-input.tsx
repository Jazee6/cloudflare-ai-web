"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ChatStatus } from "ai";
import { ArrowUp, Loader2, RefreshCw, Square, StopCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ModelSelect from "@/components/model-select";

export interface onSendMessageProps {
  message: string;
}

const formSchema = z.object({
  input: z.string().trim().min(1),
});

const ChatInput = ({
  className,
  onSendMessage,
  onStop,
  onRetry,
  status = "ready",
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  status?: ChatStatus;
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      input: "",
    },
  });

  const input = form.watch("input");

  function onSubmit(values: z.infer<typeof formSchema>) {
    form.resetField("input");
    onSendMessage({
      message: values.input,
    });
  }

  const onSendClick = () => {
    switch (status) {
      case "streaming":
        onStop?.();
        break;
      case "error":
        onRetry?.();
        break;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div
          className={cn(
            "w-full border-3 rounded-md focus-within:border-primary transition-all",
            className,
          )}
        >
          <FormField
            control={form.control}
            name="input"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    autoFocus
                    className="border-0 shadow-none focus-visible:ring-0 resize-none max-h-[50vh] scrollbar"
                    placeholder="Text here..."
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex items-center p-2">
            <ModelSelect />

            <Button
              size="icon"
              className="size-8 ml-auto"
              disabled={
                status === "submitted" ||
                (input.trim().length === 0 && status === "ready")
              }
              type={status === "ready" ? "submit" : "button"}
              onClick={onSendClick}
            >
              {status === "ready" && <ArrowUp />}
              {status === "submitted" && <Loader2 className="animate-spin" />}
              {status === "streaming" && (
                <Square className="fill-primary-foreground" />
              )}
              {status === "error" && <RefreshCw />}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default ChatInput;
