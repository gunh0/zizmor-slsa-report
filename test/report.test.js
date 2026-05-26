import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, normalizeFinding, parseZizmorJson, summarize } from "../src/report.js";

const rawFinding = {
  ident: "unpinned-uses",
  desc: "unpinned action",
  url: "https://example.test/rule",
  determinations: { severity: "High", confidence: "Medium", persona: "Regular" },
  locations: [{
    symbolic: { key: { Local: { verbatim_path: ".github/workflows/ci.yml" } }, kind: "Primary" },
    concrete: { location: { start_point: { row: 4, column: 2 } } },
  }],
};

test("normalizes zizmor v1 findings and converts rows to one-based lines", () => {
  assert.deepEqual(normalizeFinding(rawFinding), {
    id: "unpinned-uses-0",
    rule: "unpinned-uses",
    title: "unpinned action",
    severity: "high",
    confidence: "medium",
    persona: "regular",
    path: ".github/workflows/ci.yml",
    line: 5,
    column: 3,
    url: "https://example.test/rule",
  });
});

test("summarizes findings by severity", () => {
  const findings = [
    { severity: "high" }, { severity: "high" }, { severity: "medium" }, { severity: "unknown" },
  ];
  assert.deepEqual(summarize(findings), { total: 4, high: 2, medium: 1, low: 0, unknown: 1 });
});

test("builds a before-and-after delta", () => {
  const report = buildReport({ repository: "owner/repo", version: "1.0", before: [rawFinding, rawFinding], after: [rawFinding] });
  assert.equal(report.delta.resolved, 1);
  assert.equal(report.delta.highResolved, 1);
  assert.equal(report.delta.improvement, 50);
});

test("marks reports with no auditable inputs", () => {
  const report = buildReport({
    repository: "owner/repo",
    version: "1.0",
    before: [],
    after: [],
    auditableInputs: false,
  });
  assert.equal(report.audit.performed, false);
  assert.match(report.audit.message, /No auditable/);
});

test("rejects non-array zizmor output", () => {
  assert.throws(() => parseZizmorJson("{}"), /must be an array/);
});
