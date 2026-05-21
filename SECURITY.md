# Security policy

## Supported versions

Security fixes are applied to the latest revision of `main`.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature instead of opening a public issue. Include the affected endpoint, reproduction steps, impact, and any suggested mitigation. Do not include access tokens or private repository contents.

## Deployment assumptions

Prism is designed for trusted local or internal use. The analyzer:

- accepts only canonical public `github.com` repository identifiers;
- passes commands as argument arrays without a shell;
- makes a shallow clone into an operating-system temporary directory;
- applies fixes only inside that clone and deletes it after analysis;
- applies `zizmor --fix=safe`, never unsafe fixes;
- caps clone and analyzer execution time; and
- limits the number of concurrent scans.

Before exposing Prism to the internet, place it behind authentication and request-rate limiting. Run it as an unprivileged user with CPU, memory, filesystem, and network limits. Do not pass a token capable of writing to repositories.

## Trust boundary

Repository content and analyzer output are untrusted. The browser escapes all finding fields before rendering them. Prism never executes workflow content, but Git and zizmor still process attacker-controlled repository data and should remain updated.
