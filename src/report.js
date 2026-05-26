const LEVELS = ["high", "medium", "low", "unknown"];

function titleCase(value) {
  return String(value || "unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function symbolicPath(location = {}) {
  const key = location?.symbolic?.key;
  if (!key || typeof key !== "object") return null;
  const local = key.Local ?? key.local;
  return local?.verbatim_path ?? local?.path ?? null;
}

function concretePosition(location = {}) {
  const concrete = location.concrete ?? {};
  const start = concrete.location?.start_point ?? concrete.start ?? concrete.span?.start ?? {};
  return {
    line: Number(start.row ?? concrete.row ?? 0) + 1,
    column: Number(start.column ?? concrete.column ?? 0) + 1,
  };
}

export function normalizeFinding(finding, index = 0) {
  const determinations = finding.determinations ?? {};
  const locations = Array.isArray(finding.locations) ? finding.locations : [];
  const primary = locations.find((item) => String(item?.symbolic?.kind).toLowerCase() === "primary")
    ?? locations.find((item) => symbolicPath(item))
    ?? locations[0]
    ?? {};
  const position = concretePosition(primary);
  const severity = String(determinations.severity ?? finding.severity ?? "unknown").toLowerCase();
  const confidence = String(determinations.confidence ?? finding.confidence ?? "unknown").toLowerCase();

  return {
    id: `${finding.ident ?? finding.id ?? "finding"}-${index}`,
    rule: finding.ident ?? finding.id ?? "unknown",
    title: finding.desc ?? finding.message ?? titleCase(finding.ident),
    severity: LEVELS.includes(severity) ? severity : "unknown",
    confidence,
    persona: String(determinations.persona ?? "regular").toLowerCase(),
    path: symbolicPath(primary) ?? finding.path ?? "unknown",
    line: position.line,
    column: position.column,
    url: finding.url ?? null,
  };
}

export function summarize(findings = []) {
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return { total: findings.length, ...counts };
}

export function buildReport({ repository, version, before, after, diff = "", durationMs = 0, source = "live", auditableInputs = true }) {
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

export function parseZizmorJson(output) {
  const parsed = JSON.parse(output || "[]");
  if (!Array.isArray(parsed)) throw new Error("zizmor JSON output must be an array");
  return parsed;
}
