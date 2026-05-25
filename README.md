# Prism — zizmor SLSA Report

Prism turns [`zizmor`](https://github.com/zizmorcore/zizmor) findings into a compact before-and-after security report. Give it a public GitHub repository: it runs a baseline audit, applies only zizmor's safe fixes in an isolated temporary clone, scans again, and shows the improvement and exact diff.

> Prism never pushes fixes to the target repository. Every scan uses a fresh, shallow clone that is deleted after the report is built.

## What it shows

- Baseline and post-fix finding counts by severity
- Risk reduction and resolved finding counts
- Rule, confidence, file, and line for each finding
- The Git diff produced by `zizmor --fix=safe`
- A built-in example report when zizmor is not installed

## Requirements

- Node.js 20 or newer
- Git
- zizmor 1.25.2 or newer available on `PATH`

Install zizmor using the [official installation guide](https://docs.zizmor.sh/installation/). For example, with `uv`:

```bash
uv tool install zizmor
```

## Run locally

```bash
make setup
make start
```

Open <http://127.0.0.1:4173>. Set `PORT` to use another port, or `ZIZMOR_BIN` when the executable is not on `PATH`.

```bash
PORT=8080 ZIZMOR_BIN=/opt/bin/zizmor npm start
```

`MAX_CONCURRENT_ANALYSES` controls simultaneous scans and defaults to `2`.

No npm dependencies or build step are required.

## Container

```bash
docker build -t prism-report .
docker run --rm -p 4173:4173 prism-report
```

The application binds to loopback by default. Set `HOST=0.0.0.0` in a container or trusted deployment environment.

## API

```bash
curl -X POST http://127.0.0.1:4173/api/analyze \
  -H 'content-type: application/json' \
  -d '{"repository":"zizmorcore/zizmor"}'
```

Only `github.com` public repository slugs and canonical HTTPS URLs are accepted. Analysis is capped by clone and process timeouts. For an internet-facing deployment, add authentication, request throttling, and a job queue in front of the service.

## Development

```bash
npm run dev
npm test
```

Use the included Makefile to install the project-local zizmor binary and run development tasks:

```bash
make help
make setup
make dev
make check
make docker-build
make docker-run PORT=8080
```

Prism consumes zizmor's versioned `json-v1` output. JSON rows are zero-based, so the report converts them to conventional one-based line numbers.

## License

MIT
