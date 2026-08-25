# Secure setup

## 1. Create the local environment file

In PowerShell, from this folder:

```powershell
Copy-Item .env.example .env
notepad .env
```

Keep `.env` on the server only. Never add it to GitHub, a ZIP for public upload, `index.html`, or browser JavaScript.

## 2. Activate Willie with OpenAI

Create an API key in the OpenAI platform, then place it after `OPENAI_API_KEY=` in `.env`. The configured default is the cost-sensitive `gpt-5.6-luna` model through the Responses API. Do not paste the key into chat.

Optional: set `OPENAI_ALLOW_WEB_SEARCH=true` if you want Willie to use the API web-search tool for current questions. This can increase usage cost; course answers work without it.

The provider abstraction can switch to:

- `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- `AI_PROVIDER=ollama` with `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.

Restart the server after changing `.env`.

## 3. Connect payments

Create hosted checkout/payment links in your payment processor and set:

```text
CHECKOUT_ESSENTIALS_URL=
CHECKOUT_PRO_URL=
CHECKOUT_BUILDER_URL=
CHECKOUT_TEAMS_URL=
```

The website deliberately does not collect card data. Production subscription access still needs verified billing webhooks and entitlement records.

## 4. Connect email or CRM

Set `LEAD_WEBHOOK_URL` to an HTTPS webhook that accepts the lead JSON. The server also stores leads in `.runtime/leads.jsonl`. Render’s free filesystem is not durable, so production must use a database or email/CRM connector.

## 5. Run and test

```powershell
.\start-site.cmd
```

Open `http://localhost:8787`, ask Willie a course question, submit a test lead, and click each pricing button. Run automated tests with:

```powershell
node --test tests\*.test.js
```

If system Node is unavailable, run the same command with `C:\Users\wilke\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` in place of `node`.

## 6. Deploy

The included `render.yaml` starts the Node server and exposes `/api/status` as the health check. Add secrets and checkout URLs in the hosting service’s Environment settings, not in GitHub.
