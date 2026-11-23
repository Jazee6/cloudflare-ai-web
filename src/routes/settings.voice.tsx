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
import { ASR_LOCALES, type AsrLocale } from "@/lib/settings";
import { useI18n } from "@/hooks/use-i18n";

export const Route = createFileRoute("/settings/voice")({ component: VoiceSettings });

const SYSTEM_VOICE_VALUE = "__system__";
const VOICE_PREVIEW_ID = "__settings_voice_preview__";

function VoiceSettings() {
  const { locale, t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });
  const asrLocaleItems: Record<string, string> = Object.fromEntries(
    ASR_LOCALES.map((value) => [
      value,
      value === "auto"
        ? t("settings.voice.asrAuto")
        : `${languageNames.of(value) ?? value} (${value})`,
    ]),
  );
  const { supported: ttsSupported, voices } = useSpeechVoices();
  const { activeId: activeSpeechId, speak, stop: stopSpeech } = useSpeechSynthesis();
  const isPreviewing = activeSpeechId === VOICE_PREVIEW_ID;

  // Leaving the page ends the voice preview.
  useEffect(() => stopSpeech, [stopSpeech]);

  const groupedVoices = useMemo(() => {
    const groups = new Map<string, SpeechSynthesisVoice[]>();
    for (const voice of voices) {
      const lang = voice.lang || t("settings.voice.otherLanguage");
      groups.set(lang, [...(groups.get(lang) ?? []), voice]);
    }
    return Array.from(groups, ([lang, items]) => ({ lang, items }));
  }, [voices, t]);

  const ttsVoiceItems = useMemo<Record<string, string>>(
    () => ({
      [SYSTEM_VOICE_VALUE]: t("settings.voice.systemDefault"),
      ...Object.fromEntries(voices.map((voice) => [voice.voiceURI, voice.name])),
    }),
    [voices, t],
  );

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>{t("settings.voice.asrLanguage")}</FieldLabel>
        <Select
          items={asrLocaleItems}
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
            {ASR_LOCALES.map((value) => (
              <SelectItem key={value} value={value}>
                {asrLocaleItems[value]}
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
            <EmptyTitle>{t("settings.voice.ttsUnavailable")}</EmptyTitle>
            <EmptyDescription>{t("settings.voice.ttsUnavailableDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Field>
            <FieldLabel>{t("settings.voice.ttsVoice")}</FieldLabel>
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
                <SelectItem value={SYSTEM_VOICE_VALUE}>
                  {t("settings.voice.systemDefault")}
                </SelectItem>
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
              <FieldLabel>{t("settings.voice.rate")}</FieldLabel>
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
                onClick={() => {
                  if (isPreviewing) {
                    stopSpeech();
                  } else {
                    speak(VOICE_PREVIEW_ID, t("settings.voice.previewText"));
                  }
                }}
              >
                {isPreviewing ? <SquareIcon /> : <PlayIcon />}
                {isPreviewing ? t("settings.voice.stop") : t("settings.voice.test")}
              </Button>
            </div>
          </Field>

          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-skip-code-blocks">
              {t("settings.voice.skipCodeBlocks")}
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
