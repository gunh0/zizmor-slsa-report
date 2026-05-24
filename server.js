import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRepository } from "./src/analyzer.js";
import { createDemoReport } from "./src/demo.js";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const maxBody = 16 * 1024;
const maxConcurrentAnalyses = Number(process.env.MAX_CONCURRENT_ANALYSES || 2);
let activeAnalyses = 0;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > maxBody) throw new Error("Request body is too large.");
  }
  return JSON.parse(raw || "{}");
}

async function staticFile(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) return false;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "content-length": info.size,
      "cache-control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
    });
    createReadStream(filePath).pipe(response);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(response, 200, { status: "ok" });
    }
    if (request.method === "GET" && url.pathname === "/api/demo") {
      return json(response, 200, createDemoReport());
    }
    if (request.method === "POST" && url.pathname === "/api/analyze") {
      if (activeAnalyses >= maxConcurrentAnalyses) {
        response.setHeader("retry-after", "10");
        return json(response, 429, { error: "The analyzer is busy. Please try again shortly." });
      }
      const payload = await body(request);
      activeAnalyses += 1;
      try {
        const report = await analyzeRepository(payload.repository);
        return json(response, 200, report);
      } finally {
        activeAnalyses -= 1;
      }
    }
    if (request.method === "GET" && await staticFile(url.pathname, response)) return;
    json(response, 404, { error: "The requested route was not found." });
  } catch (error) {
    const missingZizmor = error?.code === "ENOENT" && (error?.path === "zizmor" || error?.syscall?.includes("spawn zizmor"));
    const message = missingZizmor
      ? "The zizmor executable was not found. Install it and restart the server."
      : error.message || "An unexpected error occurred during analysis.";
    json(response, missingZizmor ? 503 : 400, { error: message });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, host, () => {
    console.log(`zizmor report is running at http://${host}:${port}`);
  });
}

export { server };
