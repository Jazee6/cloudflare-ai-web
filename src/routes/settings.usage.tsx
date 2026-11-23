import {
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDownIcon, ArrowUpIcon, ChartColumnIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { UsageRecord } from "@/lib/db";
import { clearUsageLedger, formatCost, listAllUsage, sumUsage } from "@/lib/usage-ledger";
import {
  assignUsageSeries,
  bucketCostByDay,
  type ModelUsageRow,
  niceCeiling,
  OTHER_SERIES,
  rangeStart,
  summarizeByModel,
  USAGE_RANGES,
  type UsageDay,
  type UsageRange,
} from "@/lib/usage-stats";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";

export const Route = createFileRoute("/settings/usage")({ component: UsageSettings });

type SeriesKey = number | typeof OTHER_SERIES;

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const seriesColor = (key: SeriesKey | undefined) =>
  typeof key === "number" ? SERIES_COLORS[key] : "var(--muted-foreground)";

const formatTokens = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);

const formatDay = (date: Date, locale: string) =>
  date.toLocaleDateString(locale, { month: "short", day: "numeric" });

function UsageSettings() {
  const { t, tc } = useI18n();
  const records = useLiveQuery(listAllUsage);
  const [range, setRange] = useState<UsageRange>(30);
  const [clearOpen, setClearOpen] = useState(false);

  if (!records) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumnIcon />
          </EmptyMedia>
          <EmptyTitle>{t("settings.usage.empty")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const since = rangeStart(range).getTime();
  const inRange = records.filter((record) => new Date(record.createdAt).getTime() >= since);
  // Colors follow models across ranges, so they are assigned from the whole ledger.
  const series = assignUsageSeries(records);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[String(range)]}
          onValueChange={(values) => {
            const next = USAGE_RANGES.find((days) => String(days) === values[0]);
            if (next) {
              setRange(next);
            }
          }}
        >
          {USAGE_RANGES.map((days) => (
            <ToggleGroupItem key={days} value={String(days)}>
              {tc("settings.usage.days", days)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="ghost" onClick={() => setClearOpen(true)}>
          <Trash2Icon />
          {t("settings.usage.clear")}
        </Button>
      </div>

      <UsageTotals records={inRange} />
      <CostChart
        days={bucketCostByDay(inRange, series, range)}
        names={seriesNames(records, series, t("settings.usage.other"))}
      />
      <ModelTable rows={summarizeByModel(inRange)} series={series} />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.usage.clearTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.usage.clearDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                clearUsageLedger()
                  .then(() => toast.add({ title: t("settings.usage.cleared"), type: "success" }))
                  .catch(() =>
                    toast.add({ title: t("settings.usage.clearFailed"), type: "error" }),
                  );
                setClearOpen(false);
              }}
            >
              {t("settings.usage.clearAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The legend name of each series: its model, or the "Other" label. */
const seriesNames = (
  records: UsageRecord[],
  series: Map<string, SeriesKey>,
  otherLabel: string,
) => {
  const names = new Map<SeriesKey, string>();
  for (const row of summarizeByModel(records)) {
    const key = series.get(row.modelId);
    if (typeof key === "number") {
      names.set(key, row.modelName);
    }
  }
  if ([...series.values()].includes(OTHER_SERIES)) {
    names.set(OTHER_SERIES, otherLabel);
  }
  return names;
};

function UsageTotals({ records }: { records: UsageRecord[] }) {
  const { locale, t } = useI18n();
  const totals = sumUsage(records);
  return (
    <dl className="grid grid-cols-3 gap-3">
      <div className="flex flex-col gap-1 rounded-lg border p-3">
        <dt className="text-xs text-muted-foreground">{t("settings.usage.estimatedCost")}</dt>
        <dd className="text-2xl font-medium tabular-nums">
          {totals.priced ? formatCost(totals.cost, locale) : "—"}
        </dd>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border p-3">
        <dt className="text-xs text-muted-foreground">{t("settings.usage.inputTokens")}</dt>
        <dd className="text-2xl font-medium tabular-nums">
          {formatTokens(totals.inputTokens, locale)}
        </dd>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border p-3">
        <dt className="text-xs text-muted-foreground">{t("settings.usage.outputTokens")}</dt>
        <dd className="text-2xl font-medium tabular-nums">
          {formatTokens(totals.outputTokens, locale)}
        </dd>
      </div>
    </dl>
  );
}

const CHART_HEIGHT = 180;

/** Daily Estimated Cost as stacked columns, one segment per model series. */
function CostChart({ days, names }: { days: UsageDay[]; names: Map<SeriesKey, string> }) {
  const { locale } = useI18n();
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceCeiling(Math.max(...days.map((day) => day.total)));
  const legend = [...names.entries()].sort(([a], [b]) =>
    a === OTHER_SERIES ? 1 : b === OTHER_SERIES ? -1 : a - b,
  );
  const active = hovered === null ? undefined : days[hovered];

  if (max === 0) {
    return null;
  }

  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map(([key, name]) => (
          <li key={String(key)} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs" style={{ background: seriesColor(key) }} />
            {name}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <div
          className="flex flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
          style={{ height: CHART_HEIGHT }}
          aria-hidden
        >
          <span className="-translate-y-1/2">{formatCost(max, locale)}</span>
          <span>{formatCost(max / 2, locale)}</span>
          <span className="translate-y-1/2">{formatCost(0, locale)}</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="absolute inset-x-0 top-0 flex flex-col justify-between"
            style={{ height: CHART_HEIGHT }}
            aria-hidden
          >
            <div className="border-t" />
            <div className="border-t" />
            <div className="border-t" />
          </div>
          <div
            className="relative flex items-end gap-0.5"
            style={{ height: CHART_HEIGHT }}
            onPointerLeave={() => setHovered(null)}
          >
            {days.map((day, index) => (
              <div
                key={day.date.toISOString()}
                className="flex h-full min-w-0 flex-1 justify-center"
                onPointerEnter={() => setHovered(index)}
                aria-label={`${formatDay(day.date, locale)}: ${formatCost(day.total, locale)}`}
              >
                <div
                  className={cn(
                    "flex w-full max-w-6 flex-col-reverse justify-start gap-0.5 self-end overflow-hidden rounded-t-sm",
                    hovered !== null && hovered !== index && "opacity-50",
                  )}
                  style={{ height: `${(day.total / max) * 100}%` }}
                >
                  {[...day.costs.entries()]
                    .sort(([a], [b]) => (a === OTHER_SERIES ? 1 : b === OTHER_SERIES ? -1 : a - b))
                    .map(([key, cost]) => (
                      <div
                        key={String(key)}
                        className="min-h-px w-full"
                        style={{ flexGrow: cost / day.total, background: seriesColor(key) }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
          {active && active.total > 0 && hovered !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 flex min-w-40 flex-col gap-1 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
              style={
                hovered < days.length / 2
                  ? { left: `${((hovered + 1) / days.length) * 100}%` }
                  : { right: `${((days.length - hovered) / days.length) * 100}%` }
              }
            >
              <div className="flex justify-between gap-3 font-medium">
                <span>{formatDay(active.date, locale)}</span>
                <span className="tabular-nums">{formatCost(active.total, locale)}</span>
              </div>
              {[...active.costs.entries()]
                .sort(([, a], [, b]) => b - a)
                .map(([key, cost]) => (
                  <div key={String(key)} className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-xs"
                      style={{ background: seriesColor(key) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {names.get(key)}
                    </span>
                    <span className="tabular-nums">{formatCost(cost, locale)}</span>
                  </div>
                ))}
            </div>
          )}
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground" aria-hidden>
            <span>{formatDay(days[0].date, locale)}</span>
            <span>{formatDay(days[Math.floor(days.length / 2)].date, locale)}</span>
            <span>{formatDay(days.at(-1)!.date, locale)}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as { numeric?: boolean },
});

const columnHelper = createColumnHelper<typeof features, ModelUsageRow>();

function ModelTable({ rows, series }: { rows: ModelUsageRow[]; series: Map<string, SeriesKey> }) {
  const { locale, t } = useI18n();
  const columns = columnHelper.columns([
    columnHelper.accessor("modelName", {
      header: t("settings.usage.model"),
      sortFn: "alphanumeric",
      cell: (info) => (
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-xs"
            style={{ background: seriesColor(series.get(info.row.original.modelId)) }}
          />
          <span className="truncate">{info.getValue()}</span>
        </span>
      ),
    }),
    columnHelper.accessor("responses", {
      header: t("settings.usage.responses"),
      sortFn: "basic",
      meta: { numeric: true },
      cell: (info) => info.getValue().toLocaleString(locale),
    }),
    columnHelper.accessor("inputTokens", {
      header: t("settings.usage.input"),
      sortFn: "basic",
      meta: { numeric: true },
      cell: (info) => formatTokens(info.getValue(), locale),
    }),
    columnHelper.accessor("outputTokens", {
      header: t("settings.usage.output"),
      sortFn: "basic",
      meta: { numeric: true },
      cell: (info) => formatTokens(info.getValue(), locale),
    }),
    columnHelper.accessor((row) => row.cost ?? -1, {
      id: "cost",
      header: t("settings.usage.estimatedCost"),
      sortFn: "basic",
      meta: { numeric: true },
      cell: (info) => {
        const cost = info.row.original.cost;
        return cost === undefined ? "—" : formatCost(cost, locale);
      },
    }),
  ]);

  const table = useTable({
    features,
    columns,
    data: rows,
    initialState: { sorting: [{ id: "cost", desc: true }] },
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const numeric = header.column.columnDef.meta?.numeric;
                return (
                  <TableHead key={header.id} className={cn(numeric && "text-right")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("-mx-2", numeric && "flex-row-reverse")}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <FlexRender header={header} />
                      {sorted === "asc" && <ArrowUpIcon />}
                      {sorted === "desc" && <ArrowDownIcon />}
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    cell.column.columnDef.meta?.numeric ? "text-right tabular-nums" : "max-w-56",
                  )}
                >
                  <FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
