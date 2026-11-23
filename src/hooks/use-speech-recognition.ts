import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/settings-provider";
import { toast } from "@/components/ui/toast";
import {
  type BrowserSpeechRecognition,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  mapSpeechRecognitionError,
} from "@/lib/speech";
import { translateNow } from "@/lib/i18n";

/**
 * Drives browser-native SpeechRecognition (ASR) with live interim transcript updates
 * and automatic resource cleanup on unmount.
 */
export const useSpeechRecognition = () => {
  const { settings } = useSettings();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const prefixRef = useRef("");
  const onChangeRef = useRef<(value: string) => void>(() => {});

  const clearHandlersAndAbort = (recognition: BrowserSpeechRecognition | null) => {
    if (!recognition) {
      return;
    }
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  };

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    return () => {
      clearHandlersAndAbort(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const abort = useCallback(() => {
    clearHandlersAndAbort(recognitionRef.current);
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(
    (currentText: string, onTranscriptChange: (nextText: string) => void) => {
      const Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) {
        return;
      }

      clearHandlersAndAbort(recognitionRef.current);
      recognitionRef.current = null;

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang =
        settings.asrLocale === "auto"
          ? typeof navigator !== "undefined"
            ? navigator.language
            : "en-US"
          : settings.asrLocale;

      const trimmedBase = currentText.trimEnd();
      prefixRef.current = trimmedBase ? `${trimmedBase} ` : "";
      onChangeRef.current = onTranscriptChange;

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }
        const combined = `${prefixRef.current}${finalTranscript}${interimTranscript}`.trimStart();
        onChangeRef.current(combined);
      };

      recognition.onerror = (event) => {
        if (event.error !== "aborted") {
          toast.add({
            title: translateNow(mapSpeechRecognitionError(event.error)),
            type: "error",
          });
        }
        recognitionRef.current = null;
        setListening(false);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
      } catch {
        recognitionRef.current = null;
        setListening(false);
        toast.add({ title: translateNow("speech.startFailed"), type: "error" });
      }
    },
    [settings.asrLocale],
  );

  return { supported, listening, start, stop, abort };
};
