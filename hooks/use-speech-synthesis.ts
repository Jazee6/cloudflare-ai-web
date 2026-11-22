import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useSettings } from "@/components/settings-provider";
import { isSpeechSynthesisSupported, prepareTextForSpeech, splitSpeechChunks } from "@/lib/speech";

let activeMessageId: string | null = null;
let playbackToken = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => activeMessageId;
const getServerSnapshot = () => null;

const setActiveMessageId = (nextId: string | null) => {
  if (activeMessageId === nextId) {
    return;
  }
  activeMessageId = nextId;
  for (const listener of listeners) {
    listener();
  }
};

/** Immediately cancels any active browser speech synthesis across the entire app. */
export const stopGlobalSpeech = () => {
  playbackToken++;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  setActiveMessageId(null);
};

/** Subscribes to available browser SpeechSynthesis voices, including Chrome's async voiceschanged. */
export const useSpeechVoices = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const updateVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    updateVoices();

    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  return { supported, voices };
};

export interface SpeakOptions {
  voiceURI?: string;
  rate?: number;
  skipCodeBlocks?: boolean;
}

/**
 * Coordinates site-wide Web Speech Synthesis playback: only one message speaks at a time,
 * and long markdown replies are chunked to prevent browser utterance truncation.
 */
export const useSpeechSynthesis = () => {
  const { settings } = useSettings();
  const activeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported());
  }, []);

  const speak = useCallback(
    (id: string, markdownText: string, overrideOptions?: SpeakOptions) => {
      if (!isSpeechSynthesisSupported()) {
        return;
      }

      const skipCodeBlocks = overrideOptions?.skipCodeBlocks ?? settings.ttsSkipCodeBlocks;
      const rate = overrideOptions?.rate ?? settings.ttsRate;
      const voiceURI = overrideOptions?.voiceURI ?? settings.ttsVoiceURI;

      const cleaned = prepareTextForSpeech(markdownText, { skipCodeBlocks });
      const chunks = splitSpeechChunks(cleaned);
      stopGlobalSpeech();

      if (chunks.length === 0) {
        return;
      }

      const token = ++playbackToken;
      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = voiceURI
        ? voices.find((voice) => voice.voiceURI === voiceURI)
        : undefined;

      setActiveMessageId(id);

      const speakIndex = (index: number) => {
        if (token !== playbackToken || index >= chunks.length) {
          if (token === playbackToken) {
            setActiveMessageId(null);
          }
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.rate = rate;
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang;
        }

        utterance.onend = () => {
          if (token === playbackToken) {
            speakIndex(index + 1);
          }
        };
        utterance.onerror = () => {
          if (token === playbackToken) {
            setActiveMessageId(null);
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakIndex(0);
    },
    [settings.ttsRate, settings.ttsSkipCodeBlocks, settings.ttsVoiceURI],
  );

  return { supported, activeId, speak, stop: stopGlobalSpeech };
};
