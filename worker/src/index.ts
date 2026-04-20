import { verifySlackSignature, postSlackMessage } from './slack';
import { runAgent } from './agent';
import systemPromptTemplate from '../../system-prompt.md';
import streamOutage from '../../playbooks/stream-outage.md';

export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  ANTHROPIC_API_KEY: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ZONE_ID: string;
  DATADOG_API_KEY: string;
  DATADOG_APP_KEY: string;
}

// Bundle all playbooks into the system prompt at deploy time
const PLAYBOOKS = [streamOutage].join('\n\n---\n\n');
const SYSTEM_PROMPT = systemPromptTemplate.replace('{{PLAYBOOKS}}', PLAYBOOKS);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST' || !new URL(request.url).pathname.startsWith('/slack')) {
      return new Response('Not found', { status: 404 });
    }

    const body = await request.text();

    if (!(await verifySlackSignature(request, env.SLACK_SIGNING_SECRET, body))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = JSON.parse(body);

    // Slack URL verification handshake
    if (payload.type === 'url_verification') {
      return Response.json({ challenge: payload.challenge });
    }

    // Acknowledge Slack immediately — process async
    ctx.waitUntil(handleEvent(payload, env));
    return new Response('', { status: 200 });
  },
};

async function handleEvent(payload: any, env: Env): Promise<void> {
  const event = payload.event;
  if (!event) return;

  // Only respond to messages that mention the bot, ignore bot's own messages
  if (event.type !== 'app_mention' || event.bot_id) return;

  const userMessage = event.text.replace(/<@[^>]+>/g, '').trim();
  if (!userMessage) return;

  const agentEnv = {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    cloudflareZoneId: env.CLOUDFLARE_ZONE_ID,
    datadogApiKey: env.DATADOG_API_KEY,
    datadogAppKey: env.DATADOG_APP_KEY,
  };

  const response = await runAgent(SYSTEM_PROMPT, [], userMessage, agentEnv);

  await postSlackMessage(
    env.SLACK_BOT_TOKEN,
    event.channel,
    response,
    event.thread_ts ?? event.ts
  );
}
