import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildReport, parseZizmorJson, type RawFinding, type Report } from "./report.js";

const execFileAsync = promisify(execFile);
const OWNER_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const localZizmor = join(process.cwd(), ".tools", "zizmor");

interface Repository {
  slug: string;
  url: string;
}

interface RunOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

interface ZizmorResult {
  findings: RawFinding[];
  noInputs: boolean;
}

function zizmorBinary(): string {
  return process.env.ZIZMOR_BIN || (existsSync(localZizmor) ? localZizmor : "zizmor");
}

export function parseRepository(input: unknown): Repository {
  const value = String(input ?? "").trim().replace(/\.git$/, "");
  let slug = value;

  if (value.startsWith("https://github.com/")) slug = value.slice("https://github.com/".length);
  else if (value.startsWith("http://github.com/")) slug = value.slice("http://github.com/".length);

  slug = slug.replace(/^\/+|\/+$/g, "");
  if (!OWNER_REPO.test(slug)) {
    throw new Error("Enter a GitHub repository as owner/repo or https://github.com/owner/repo.");
  }

  return { slug, url: `https://github.com/${slug}.git` };
}

function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const timeout = options.timeout ?? 120_000;
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, NO_COLOR: "1", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new Error(`${command} timed out.`));
      resolve({ code, stdout, stderr });
    });
  });
}

async function zizmor(args: string[], cwd: string): Promise<ZizmorResult> {
  const binary = zizmorBinary();
  const result = await run(binary, args, { cwd });
  if (result.code === 3 || /no inputs collected/i.test(`${result.stdout}\n${result.stderr}`)) {
    return { findings: [], noInputs: true };
  }
  // zizmor uses 10+ exit codes to communicate findings; valid JSON is authoritative.
  if (!result.stdout.trim().startsWith("[")) {
    throw new Error(result.stderr.trim() || "zizmor did not return valid JSON output.");
  }
  return { findings: parseZizmorJson(result.stdout), noInputs: false };
}

export async function analyzeRepository(input: unknown): Promise<Report> {
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

    const versionResult = await run(zizmorBinary(), ["--version"], { cwd: repoPath, timeout: 10_000 });
    const version = versionResult.stdout.trim() || versionResult.stderr.trim() || "unknown";
    const beforeRun = await zizmor(["--format=json-v1", "--no-progress", "."], repoPath);

    if (beforeRun.noInputs) {
      return buildReport({
        repository: repository.slug,
        version,
        before: [],
        after: [],
        durationMs: Date.now() - startedAt,
        auditableInputs: false,
      });
    }

    // Safe mode intentionally excludes fixes that require semantic review.
    await run(zizmorBinary(), ["--fix=safe", "--no-progress", "."], { cwd: repoPath });
    const afterRun = await zizmor(["--format=json-v1", "--no-progress", "."], repoPath);
    const diffResult = await run("git", ["diff", "--", "."], { cwd: repoPath });

    return buildReport({
      repository: repository.slug,
      version,
      before: beforeRun.findings,
      after: afterRun.findings,
      diff: diffResult.stdout.slice(0, 250_000),
      durationMs: Date.now() - startedAt,
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
