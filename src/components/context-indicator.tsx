import type { UIMessage } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { InputGroupButton } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { useSettings } from "@/components/settings-provider";
import { withoutFailedResponses } from "@/lib/failed-response";
import { buildModelContext } from "@/lib/model-context";
import { getResponseMetadata } from "@/lib/response-metadata";
import { formatCost, listConversationUsage, sumUsage } from "@/lib/usage-ledger";
import { useI18n } from "@/hooks/use-i18n";

const formatTokens = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);

/**
 * Shows the Context Usage reported for the latest response and how much of the loaded
 * Conversation History the next Model Context includes.
 */
const ContextIndicator = ({
  sessionId,
  messages: allMessages,
}: {
  sessionId: string;
  messages: UIMessage[];
}) => {
  const { settings } = useSettings();
  const { locale, t } = useI18n();
  // Read from the Usage Ledger, so responses a Retry replaced still count.
  const spent = useLiveQuery(
    async () => sumUsage(await listConversationUsage(sessionId)),
    [sessionId],
  );
  const messages = withoutFailedResponses(allMessages);
  if (messages.length === 0) {
    return null;
  }

  const included =
    buildModelContext(messages, { maxMessages: settings.contextMessageLimit })?.length ?? 0;
  // A streaming response has no usage yet, so keep showing the last one that reported it.
  const metadata = messages
    .filter((message) => message.role === "assistant")
    .map(getResponseMetadata)
    .findLast((candidate) => candidate?.usage);
  const usage =
    metadata?.usage && metadata.contextWindow
      ? {
          ...metadata.usage,
          used: metadata.usage.inputTokens + metadata.usage.outputTokens,
          limit: metadata.contextWindow,
        }
      : undefined;
  const percent = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : undefined;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={10}
        closeDelay={100}
        render={
          <InputGroupButton
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary aria-expanded:text-primary"
          />
        }
      >
        {percent === undefined
          ? t("context.messagesShort", { included, total: messages.length })
          : t("context.percentShort", { percent })}
      </HoverCardTrigger>
      <HoverCardContent className="flex w-64 flex-col gap-3">
        {usage && percent !== undefined && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{t("context.title")}</span>
              <span className="text-muted-foreground">
                {formatTokens(usage.used, locale)} / {formatTokens(usage.limit, locale)}
              </span>
            </div>
            <Progress value={percent} aria-label={t("context.used")} />
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("context.input")}</span>
                <span>{formatTokens(usage.inputTokens, locale)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("context.output")}</span>
                <span>{formatTokens(usage.outputTokens, locale)}</span>
              </div>
            </div>
          </div>
        )}
        {spent?.priced && (
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t("context.estimatedCost")}</span>
            <span className="tabular-nums">{formatCost(spent.cost, locale)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{t("context.messagesIncluded")}</span>
          <span>
            {included} / {messages.length}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ContextIndicator;
