import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildReport, parseZizmorJson } from "./report.js";

const execFileAsync = promisify(execFile);
const OWNER_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export function parseRepository(input) {
  const value = String(input ?? "").trim().replace(/\.git$/, "");
  let slug = value;

  if (value.startsWith("https://github.com/")) slug = value.slice("https://github.com/".length);
  else if (value.startsWith("http://github.com/")) slug = value.slice("http://github.com/".length);

  slug = slug.replace(/^\/+|\/+$/g, "");
  if (!OWNER_REPO.test(slug)) {
    throw new Error("GitHub 저장소를 owner/repo 또는 https://github.com/owner/repo 형식으로 입력해 주세요.");
  }

  return { slug, url: `https://github.com/${slug}.git` };
}

function run(command, args, options = {}) {
  const timeout = options.timeout ?? 120_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, NO_COLOR: "1", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new Error(`${command} 실행 시간이 초과되었습니다.`));
      resolve({ code, stdout, stderr });
    });
  });
}

async function zizmor(args, cwd) {
  const binary = process.env.ZIZMOR_BIN || "zizmor";
  const result = await run(binary, args, { cwd });
  // zizmor uses 10+ exit codes to communicate findings; valid JSON is authoritative.
  if (!result.stdout.trim().startsWith("[")) {
    throw new Error(result.stderr.trim() || "zizmor가 유효한 JSON 결과를 반환하지 않았습니다.");
  }
  return parseZizmorJson(result.stdout);
}

export async function analyzeRepository(input) {
  const repository = parseRepository(input);
  const workspace = await mkdtemp(join(tmpdir(), "zizmor-report-"));
  const repoPath = join(workspace, "repository");
  const startedAt = Date.now();

  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--no-tags", "--", repository.url, repoPath], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    const versionResult = await run(process.env.ZIZMOR_BIN || "zizmor", ["--version"], { cwd: repoPath, timeout: 10_000 });
    const version = versionResult.stdout.trim() || versionResult.stderr.trim() || "unknown";
    const before = await zizmor(["--format=json-v1", "--no-progress", "."], repoPath);

    // Safe mode intentionally excludes fixes that require semantic review.
    await run(process.env.ZIZMOR_BIN || "zizmor", ["--fix=safe", "--no-progress", "."], { cwd: repoPath });
    const after = await zizmor(["--format=json-v1", "--no-progress", "."], repoPath);
    const diffResult = await run("git", ["diff", "--", ".github", ".pre-commit-config.yaml", ".pre-commit-config.yml"], { cwd: repoPath });

    return buildReport({
      repository: repository.slug,
      version,
      before,
      after,
      diff: diffResult.stdout,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
