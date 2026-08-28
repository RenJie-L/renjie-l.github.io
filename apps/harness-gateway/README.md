# Personal Site Harness Gateway

Cloudflare Worker gateway for the public, read-only Personal Site Harness.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and set `DEEPSEEK_API_KEY`.
2. Build or run the Astro site so `/harness-knowledge.json` is available.
3. From the repository root, run `npm run harness:dev`.
4. Run the Astro site with `PUBLIC_HARNESS_API_URL=http://localhost:8787`.

The example `.dev.vars` points `KNOWLEDGE_URL` at the local Astro server. Change it if Astro is running on another host or port.

The Worker exposes:

- `GET /v1/health`
- `POST /v1/chat` with a `text/event-stream` response

Tools are internal and are never exposed as public HTTP endpoints.

## Deploy

Configure the encrypted secret once:

```bash
npx wrangler secret put DEEPSEEK_API_KEY --config apps/harness-gateway/wrangler.jsonc
```

Deploy the Worker:

```bash
npm run harness:deploy
```

Set the deployed URL in the site build environment:

```text
PUBLIC_HARNESS_API_URL=https://renjie-harness-api.<account>.workers.dev
```

Never place `DEEPSEEK_API_KEY` in the Astro environment or a `PUBLIC_*` variable.
