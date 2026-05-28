const LEVELS = ["high", "medium", "low", "unknown"] as const;
export type Severity = typeof LEVELS[number];

type UnknownRecord = Record<string, unknown>;

export interface RawFinding extends UnknownRecord {
  ident?: string;
  id?: string;
  desc?: string;
  message?: string;
  severity?: string;
  confidence?: string;
  path?: string;
  url?: string;
  determinations?: UnknownRecord;
  locations?: UnknownRecord[];
}

export interface Finding {
  id: string;
  rule: string;
  title: string;
  severity: Severity;
  confidence: string;
  persona: string;
  path: string;
  line: number;
  column: number;
  url: string | null;
}

export interface Summary extends Record<Severity, number> { total: number }

export interface Report {
  repository: string;
  version: string;
  generatedAt: string;
  durationMs: number;
  source: string;
  audit: { performed: boolean; message: string };
  before: { summary: Summary; findings: Finding[] };
  after: { summary: Summary; findings: Finding[] };
  delta: { resolved: number; highResolved: number; improvement: number };
  diff: string;
}

interface BuildReportOptions {
  repository: string;
  version: string;
  before: RawFinding[];
  after: RawFinding[];
  diff?: string;
  durationMs?: number;
  source?: string;
  auditableInputs?: boolean;
}

function titleCase(value: unknown): string {
  return String(value || "unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function symbolicPath(location: UnknownRecord = {}): string | null {
  const symbolic = location.symbolic as UnknownRecord | undefined;
  const key = symbolic?.key as UnknownRecord | undefined;
  if (!key || typeof key !== "object") return null;
  const local = (key.Local ?? key.local) as UnknownRecord | undefined;
  const path = local?.verbatim_path ?? local?.path;
  return typeof path === "string" ? path : null;
}

function concretePosition(location: UnknownRecord = {}) {
  const concrete = (location.concrete ?? {}) as UnknownRecord;
  const concreteLocation = concrete.location as UnknownRecord | undefined;
  const span = concrete.span as UnknownRecord | undefined;
  const start = (concreteLocation?.start_point ?? concrete.start ?? span?.start ?? {}) as UnknownRecord;
  return {
    line: Number(start.row ?? concrete.row ?? 0) + 1,
    column: Number(start.column ?? concrete.column ?? 0) + 1,
  };
}

export function normalizeFinding(finding: RawFinding, index = 0): Finding {
  const determinations = finding.determinations ?? {};
  const locations = Array.isArray(finding.locations) ? finding.locations : [];
  const primary = locations.find((item) => String((item.symbolic as UnknownRecord | undefined)?.kind).toLowerCase() === "primary")
    ?? locations.find((item) => symbolicPath(item))
    ?? locations[0]
    ?? {};
  const position = concretePosition(primary);
  const rawSeverity = String(determinations.severity ?? finding.severity ?? "unknown").toLowerCase();
  const severity: Severity = LEVELS.includes(rawSeverity as Severity) ? rawSeverity as Severity : "unknown";
  const confidence = String(determinations.confidence ?? finding.confidence ?? "unknown").toLowerCase();

  return {
    id: `${finding.ident ?? finding.id ?? "finding"}-${index}`,
    rule: finding.ident ?? finding.id ?? "unknown",
    title: finding.desc ?? finding.message ?? titleCase(finding.ident),
    severity,
    confidence,
    persona: String(determinations.persona ?? "regular").toLowerCase(),
    path: symbolicPath(primary) ?? finding.path ?? "unknown",
    line: position.line,
    column: position.column,
    url: finding.url ?? null,
  };
}

export function summarize(findings: ReadonlyArray<{ severity: Severity }> = []): Summary {
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return { total: findings.length, ...counts };
}

export function buildReport({ repository, version, before, after, diff = "", durationMs = 0, source = "live", auditableInputs = true }: BuildReportOptions): Report {
  const normalizedBefore = before.map(normalizeFinding);
  const normalizedAfter = after.map(normalizeFinding);
  const beforeSummary = summarize(normalizedBefore);
  const afterSummary = summarize(normalizedAfter);

  return {
    repository,
    version,
    generatedAt: new Date().toISOString(),
    durationMs,
    source,
    audit: {
      performed: auditableInputs,
      message: auditableInputs
        ? "Audit completed."
        : "No auditable GitHub Actions, Dependabot, or pre-commit configuration was found.",
    },
    before: { summary: beforeSummary, findings: normalizedBefore },
    after: { summary: afterSummary, findings: normalizedAfter },
    delta: {
      resolved: Math.max(0, beforeSummary.total - afterSummary.total),
      highResolved: Math.max(0, beforeSummary.high - afterSummary.high),
      improvement: beforeSummary.total === 0
        ? 0
        : Math.round(((beforeSummary.total - afterSummary.total) / beforeSummary.total) * 100),
    },
    diff,
  };
}

export function parseZizmorJson(output: string): RawFinding[] {
  const parsed: unknown = JSON.parse(output || "[]");
  if (!Array.isArray(parsed)) throw new Error("zizmor JSON output must be an array");
  return parsed;
}
