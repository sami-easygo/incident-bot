import Anthropic from '@anthropic-ai/sdk';
import { queryCloudflare, cloudflareTool } from './tools/cloudflare';
import { queryDatadog, datadogTool } from './tools/datadog';

interface AgentEnv {
  anthropicApiKey: string;
  cloudflareApiToken: string;
  cloudflareZoneId: string;
  datadogApiKey: string;
  datadogAppKey: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function runAgent(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  env: AgentEnv
): Promise<string> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const tools = [cloudflareTool, datadogTool];

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  let response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: systemPrompt,
    tools: tools as Anthropic.Tool[],
    messages,
  });

  // Agentic loop — keep going until Claude stops calling tools
  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      let result: string;
      try {
        result = await executeTool(toolUse.name, toolUse.input as Record<string, any>, env);
      } catch (e) {
        result = `Error: ${e instanceof Error ? e.message : 'unknown error'}`;
      }
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    });
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return textBlock?.text ?? 'No response generated.';
}

async function executeTool(
  name: string,
  input: Record<string, any>,
  env: AgentEnv
): Promise<string> {
  if (name === 'query_cloudflare') {
    return queryCloudflare(
      env.cloudflareApiToken,
      env.cloudflareZoneId,
      input.query_type,
      input.since
    );
  }
  if (name === 'query_datadog') {
    return queryDatadog(env.datadogApiKey, env.datadogAppKey, input.query_type, {
      query: input.query,
      filter: input.filter,
      from: input.from,
      to: input.to,
    });
  }
  return `Unknown tool: ${name}`;
}
