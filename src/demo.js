import { buildReport } from "./report.js";

const finding = (ident, desc, severity, confidence, path, row) => ({
  ident,
  desc,
  url: `https://docs.zizmor.sh/audits/#${ident}`,
  determinations: { severity, confidence, persona: "Regular" },
  locations: [{
    symbolic: { key: { Local: { verbatim_path: path } } },
    concrete: { start: { row, column: 8 } },
  }],
});

export function createDemoReport() {
  const before = [
    finding("template-injection", "code injection via template expansion", "High", "High", ".github/workflows/release.yml", 31),
    finding("excessive-permissions", "overly broad GitHub token permissions", "High", "High", ".github/workflows/ci.yml", 4),
    finding("unpinned-uses", "action is not pinned to a full length commit SHA", "Medium", "High", ".github/workflows/ci.yml", 18),
    finding("unpinned-uses", "action is not pinned to a full length commit SHA", "Medium", "High", ".github/workflows/release.yml", 22),
    finding("artipacked", "credential persistence through actions/checkout", "Medium", "Medium", ".github/workflows/release.yml", 14),
    finding("cache-poisoning", "cache usage may cross a privilege boundary", "Medium", "Medium", ".github/workflows/ci.yml", 42),
    finding("dangerous-triggers", "dangerous use of pull_request_target", "High", "High", ".github/workflows/triage.yml", 2),
    finding("stale-action-refs", "action reference is stale", "Low", "High", ".github/workflows/docs.yml", 16),
  ];
  const after = [before[0], before[4], before[5], before[6]];

  return buildReport({
    repository: "acme/checkout-service",
    version: "zizmor 1.25.2",
    before,
    after,
    durationMs: 2840,
    source: "demo",
    diff: `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 48c9d10..7e3ab91 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,8 +1,11 @@
 name: CI
 on: [push, pull_request]
+permissions:
+  contents: read
 jobs:
   test:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
       - run: npm test`,
  });
}
