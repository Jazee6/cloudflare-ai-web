import { createFileRoute } from "@tanstack/react-router";
import { PlayIcon, SquareIcon, VolumeXIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSpeechSynthesis, useSpeechVoices } from "@/hooks/use-speech-synthesis";
import { ASR_LOCALE_OPTIONS, type AsrLocale } from "@/lib/settings";

export const Route = createFileRoute("/settings/voice")({ component: VoiceSettings });

const SYSTEM_VOICE_VALUE = "__system__";
const VOICE_PREVIEW_ID = "__settings_voice_preview__";
const ASR_LOCALE_ITEMS: Record<string, string> = Object.fromEntries(
  ASR_LOCALE_OPTIONS.map((option) => [option.value, option.label]),
);

function VoiceSettings() {
  const { settings, updateSettings } = useSettings();
  const { supported: ttsSupported, voices } = useSpeechVoices();
  const { activeId: activeSpeechId, speak, stop: stopSpeech } = useSpeechSynthesis();
  const isPreviewing = activeSpeechId === VOICE_PREVIEW_ID;

  // Leaving the page ends the voice preview.
  useEffect(() => stopSpeech, [stopSpeech]);

  const groupedVoices = useMemo(() => {
    const groups = new Map<string, SpeechSynthesisVoice[]>();
    for (const voice of voices) {
      const lang = voice.lang || "Other";
      groups.set(lang, [...(groups.get(lang) ?? []), voice]);
    }
    return Array.from(groups, ([lang, items]) => ({ lang, items }));
  }, [voices]);

  const ttsVoiceItems = useMemo<Record<string, string>>(
    () => ({
      [SYSTEM_VOICE_VALUE]: "System default",
      ...Object.fromEntries(voices.map((voice) => [voice.voiceURI, voice.name])),
    }),
    [voices],
  );

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Voice Input Language</FieldLabel>
        <Select
          items={ASR_LOCALE_ITEMS}
          value={settings.asrLocale}
          onValueChange={(value) => {
            if (typeof value === "string") {
              updateSettings({ asrLocale: value as AsrLocale });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASR_LOCALE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {!ttsSupported ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <VolumeXIcon />
            </EmptyMedia>
            <EmptyTitle>Speech synthesis unavailable</EmptyTitle>
            <EmptyDescription>
              This browser does not expose Web Speech Synthesis voices.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Field>
            <FieldLabel>Read Aloud Voice</FieldLabel>
            <Select
              items={ttsVoiceItems}
              value={settings.ttsVoiceURI || SYSTEM_VOICE_VALUE}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  updateSettings({ ttsVoiceURI: value === SYSTEM_VOICE_VALUE ? "" : value });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SYSTEM_VOICE_VALUE}>System default</SelectItem>
                {groupedVoices.map(({ lang, items }) => (
                  <SelectGroup key={lang}>
                    <SelectLabel>{lang}</SelectLabel>
                    {items.map((voice) => (
                      <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Reading Speed</FieldLabel>
              <span className="text-xs text-muted-foreground tabular-nums">
                {settings.ttsRate.toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[settings.ttsRate]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") {
                    updateSettings({ ttsRate: Math.round(next * 10) / 10 });
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isPreviewing) {
                    stopSpeech();
                  } else {
                    speak(
                      VOICE_PREVIEW_ID,
                      "This is a preview of the selected voice and reading speed.",
                    );
                  }
                }}
              >
                {isPreviewing ? <SquareIcon /> : <PlayIcon />}
                {isPreviewing ? "Stop" : "Test"}
              </Button>
            </div>
          </Field>

          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-skip-code-blocks">
              Skip code blocks when reading
            </FieldLabel>
            <Switch
              id="settings-skip-code-blocks"
              checked={settings.ttsSkipCodeBlocks}
              onCheckedChange={(checked) => updateSettings({ ttsSkipCodeBlocks: checked })}
            />
          </Field>
        </>
      )}
    </FieldGroup>
  );
}
