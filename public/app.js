const elements = {
  form: document.querySelector("#scan-form"),
  repository: document.querySelector("#repository"),
  demo: document.querySelector("#demo-button"),
  report: document.querySelector("#report"),
  notice: document.querySelector("#notice"),
  loader: document.querySelector("#loader"),
  loaderCopy: document.querySelector("#loader-copy"),
  findingsBody: document.querySelector("#findings-body"),
  emptyState: document.querySelector("#empty-state"),
};

let report = null;
let activeView = "before";
let loaderTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(new Date(value));
}

function severityBars(summary) {
  if (!summary.total) return '<span class="empty"></span>';
  return ["high", "medium", "low", "unknown"]
    .filter((level) => summary[level])
    .map((level) => `<span class="${level}" style="flex:${summary[level]}" title="${level}: ${summary[level]}"></span>`)
    .join("");
}

function renderFindings() {
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
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
}

function highlightDiff(diff) {
  return escapeHtml(diff || "No safe fixes were applied.")
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) return `<span class="diff-add">${line}</span>`;
      if (line.startsWith("-") && !line.startsWith("---")) return `<span class="diff-remove">${line}</span>`;
      if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")) return `<span class="diff-meta">${line}</span>`;
      return line;
    }).join("\n");
}

function render(nextReport) {
  report = nextReport;
  activeView = "before";
  document.querySelector("#repo-name").textContent = report.repository;
  document.querySelector("#generated-at").textContent = formatDate(report.generatedAt);
  document.querySelector("#version").textContent = report.version;
  const auditState = document.querySelector("#audit-state");
  auditState.hidden = report.audit?.performed !== false;
  auditState.textContent = report.audit?.message || "";
  document.querySelector("#before-total").textContent = report.before.summary.total;
  document.querySelector("#after-total").textContent = report.after.summary.total;
  document.querySelector("#before-count").textContent = report.before.summary.total;
  document.querySelector("#after-count").textContent = report.after.summary.total;
  document.querySelector("#before-bars").innerHTML = severityBars(report.before.summary);
  document.querySelector("#after-bars").innerHTML = severityBars(report.after.summary);
  document.querySelector("#improvement").textContent = `${report.delta.improvement}%`;
  document.querySelector("#resolved").textContent = `${report.delta.resolved} findings resolved`;
  document.querySelector("#diff-output").innerHTML = highlightDiff(report.diff);
  document.querySelector("#duration").textContent = `Completed in ${(report.durationMs / 1000).toFixed(2)}s · ${report.source}`;
  renderFindings();
  elements.report.hidden = false;
  elements.report.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setLoading(loading) {
  clearInterval(loaderTimer);
  elements.loader.hidden = !loading;
  if (!loading) return;
  const messages = ["Cloning repository…", "Running baseline audit…", "Applying safe fixes…", "Verifying improvements…"];
  let index = 0;
  elements.loaderCopy.textContent = messages[index];
  loaderTimer = setInterval(() => {
    index = Math.min(index + 1, messages.length - 1);
    elements.loaderCopy.textContent = messages[index];
  }, 1700);
}

async function requestReport(url, options) {
  elements.notice.hidden = true;
  setLoading(true);
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The report could not be generated.");
    render(data);
  } catch (error) {
    elements.notice.textContent = error.message;
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
document.querySelectorAll("[data-repository]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.repository.value = button.dataset.repository;
    requestReport("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repository: button.dataset.repository }),
    });
  });
});
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    renderFindings();
  });
});
document.querySelector("#copy-diff").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(report?.diff || "");
  const button = event.currentTarget;
  const original = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = original; }, 1200);
});
document.querySelector("#download-report").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.repository.replace("/", "-")}-zizmor-report.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#print-report").addEventListener("click", () => window.print());

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  requestReport("/api/demo");
}
