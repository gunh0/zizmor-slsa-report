# Contributing

Thanks for improving Prism.

## Local workflow

1. Use Node.js 20 or newer.
2. Install a supported version of zizmor.
3. Run `npm test` before submitting a change.
4. Start the application with `npm run dev` and verify both the example report and a public repository scan.

## Design principles

- Preserve zizmor's original severity and confidence values.
- Keep the baseline immutable; fixes belong only in the temporary clone.
- Never enable unsafe fixes implicitly.
- Treat repository names, paths, finding messages, and diffs as untrusted data.
- Keep the application usable without a frontend build tool.

## Tests

Parser changes should include a representative zizmor `json-v1` fixture or focused object. Input validation changes must cover accepted and rejected repository identifiers. Tests use Node's built-in test runner and should not require network access.

## Commit style

Use a short conventional prefix such as `feat:`, `fix:`, `docs:`, `test:`, or `security:` followed by an imperative summary.
