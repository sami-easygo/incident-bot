# Kick Incident Management Agent

AI-powered incident response agent for Kick engineering. Lives in Slack incident channels, queries Cloudflare and Datadog in real time, and guides engineers through resolution using encoded playbooks.

## How it works

1. An incident fires → PagerDuty → Slack channel created
2. @mention the bot in the incident channel
3. Bot queries live Cloudflare + Datadog data
4. Bot responds with diagnosis and next steps based on known playbooks

## Repo structure

```
system-prompt.md          # Core agent instructions and persona
playbooks/                # Incident playbooks — contribute here
  stream-outage.md
worker/                   # Cloudflare Worker source
  src/
    index.ts              # Entry point, Slack event handling
    agent.ts              # Claude API + agentic tool loop
    slack.ts              # Slack verification + posting
    tools/
      cloudflare.ts       # Cloudflare API integration
      datadog.ts          # Datadog API integration
```

## Contributing playbooks

Add a new `.md` file to `/playbooks/` following the format in `stream-outage.md`. Open a PR — on merge, the agent is automatically redeployed with the new knowledge.

## Setup

### 1. Install dependencies
```bash
cd worker && npm install
```

### 2. Configure the zone ID
Set `CLOUDFLARE_ZONE_ID` in `wrangler.toml`.

### 3. Set secrets
```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put DATADOG_API_KEY
wrangler secret put DATADOG_APP_KEY
```

### 4. Deploy
```bash
npm run deploy
```

### 5. Connect to Slack
- Create a Slack app with `app_mentions:read` and `chat:write` scopes
- Set the event subscription URL to your Worker URL + `/slack/events`
- Subscribe to `app_mention` events
- Install the app to your workspace and invite it to incident channels

## Local dev
```bash
npm run dev
```
Use [ngrok](https://ngrok.com) to expose localhost to Slack for local testing.
