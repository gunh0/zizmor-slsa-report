import type { Report, Severity, Summary } from "./report.js";

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const elements = {
  form: query<HTMLFormElement>("#scan-form"),
  repository: query<HTMLInputElement>("#repository"),
  demo: query<HTMLButtonElement>("#demo-button"),
  report: query<HTMLElement>("#report"),
  notice: query<HTMLElement>("#notice"),
  loader: query<HTMLElement>("#loader"),
  loaderCopy: query<HTMLElement>("#loader-copy"),
  findingsBody: query<HTMLTableSectionElement>("#findings-body"),
  emptyState: query<HTMLElement>("#empty-state"),
};

let report: Report | null = null;
let activeView: "before" | "after" = "before";
let loaderTimer: ReturnType<typeof setInterval> | undefined;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(new Date(value));
}

function severityBars(summary: Summary): string {
  if (!summary.total) return '<span class="empty"></span>';
  return (["high", "medium", "low", "unknown"] as Severity[])
    .filter((level) => summary[level])
    .map((level) => `<span class="${level}" style="flex:${summary[level]}" title="${level}: ${summary[level]}"></span>`)
    .join("");
}

function renderFindings(): void {
  const findings = report?.[activeView]?.findings ?? [];
  elements.findingsBody.innerHTML = findings.map((finding) => `
    <tr>
      <td><span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
      <td class="audit-name"><strong>${escapeHtml(finding.rule)}</strong><span>${escapeHtml(finding.title)}</span></td>
      <td class="location">${escapeHtml(finding.path)}:${finding.line}</td>
      <td class="confidence">${escapeHtml(finding.confidence)}</td>
      <td>${finding.url ? `<a class="finding-link" href="${escapeHtml(finding.url)}" target="_blank" rel="noreferrer" aria-label="Open audit rule documentation">↗</a>` : ""}</td>
    </tr>`).join("");
  elements.emptyState.hidden = findings.length > 0;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
}

function highlightDiff(diff: string): string {
  return escapeHtml(diff || "No safe fixes were applied.")
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) return `<span class="diff-add">${line}</span>`;
      if (line.startsWith("-") && !line.startsWith("---")) return `<span class="diff-remove">${line}</span>`;
      if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")) return `<span class="diff-meta">${line}</span>`;
      return line;
    }).join("\n");
}

function render(nextReport: Report): void {
  report = nextReport;
  activeView = "before";
  query("#repo-name").textContent = report.repository;
  query("#generated-at").textContent = formatDate(report.generatedAt);
  query("#version").textContent = report.version;
  const auditState = query<HTMLElement>("#audit-state");
  auditState.hidden = report.audit?.performed !== false;
  auditState.textContent = report.audit?.message || "";
  query("#before-total").textContent = String(report.before.summary.total);
  query("#after-total").textContent = String(report.after.summary.total);
  query("#before-count").textContent = String(report.before.summary.total);
  query("#after-count").textContent = String(report.after.summary.total);
  query<HTMLElement>("#before-bars").innerHTML = severityBars(report.before.summary);
  query<HTMLElement>("#after-bars").innerHTML = severityBars(report.after.summary);
  query("#improvement").textContent = `${report.delta.improvement}%`;
  query("#resolved").textContent = `${report.delta.resolved} findings resolved`;
  query<HTMLElement>("#diff-output").innerHTML = highlightDiff(report.diff);
  query("#duration").textContent = `Completed in ${(report.durationMs / 1000).toFixed(2)}s · ${report.source}`;
  renderFindings();
  elements.report.hidden = false;
  elements.report.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setLoading(loading: boolean): void {
  if (loaderTimer) clearInterval(loaderTimer);
  elements.loader.hidden = !loading;
  if (!loading) return;
  const messages = ["Cloning repository…", "Running baseline audit…", "Applying safe fixes…", "Verifying improvements…"];
  let index = 0;
  elements.loaderCopy.textContent = messages[index] ?? "Running analysis…";
  loaderTimer = setInterval(() => {
    index = Math.min(index + 1, messages.length - 1);
    elements.loaderCopy.textContent = messages[index] ?? "Running analysis…";
  }, 1700);
}

async function requestReport(url: string, options?: RequestInit): Promise<void> {
  elements.notice.hidden = true;
  setLoading(true);
  try {
    const response = await fetch(url, options);
    const data: unknown = await response.json();
    if (!response.ok) {
      const message = typeof data === "object" && data && "error" in data ? String(data.error) : "The report could not be generated.";
      throw new Error(message);
    }
    render(data as Report);
  } catch (error: unknown) {
    elements.notice.textContent = error instanceof Error ? error.message : "The report could not be generated.";
    elements.notice.hidden = false;
  } finally {
    setLoading(false);
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const repository = elements.repository.value.trim();
  if (!repository) {
    elements.notice.textContent = "Enter a GitHub repository to analyze.";
    elements.notice.hidden = false;
    return;
  }
  requestReport("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repository }),
  });
});

elements.demo.addEventListener("click", () => requestReport("/api/demo"));
document.querySelectorAll<HTMLButtonElement>("[data-repository]").forEach((button) => {
  button.addEventListener("click", () => {
    const repository = button.dataset.repository;
    if (!repository) return;
    elements.repository.value = repository;
    requestReport("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repository }),
    });
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view === "after" ? "after" : "before";
    renderFindings();
  });
});
query<HTMLButtonElement>("#copy-diff").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(report?.diff || "");
  const button = event.currentTarget as HTMLButtonElement;
  const original = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = original; }, 1200);
});
query<HTMLButtonElement>("#download-report").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.repository.replace("/", "-")}-zizmor-report.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});
query<HTMLButtonElement>("#print-report").addEventListener("click", () => window.print());

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  requestReport("/api/demo");
}
