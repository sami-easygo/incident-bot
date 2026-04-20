const CF_API = 'https://api.cloudflare.com/client/v4';

export async function queryCloudflare(
  apiToken: string,
  zoneId: string,
  queryType: 'traffic' | 'firewall_events' | 'zone_health',
  since?: string
): Promise<string> {
  const sinceTime = since ?? new Date(Date.now() - 30 * 60 * 1000).toISOString();

  if (queryType === 'zone_health') {
    const res = await fetch(`${CF_API}/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const data = await res.json() as any;
    return JSON.stringify({ status: data.result?.status, paused: data.result?.paused });
  }

  if (queryType === 'firewall_events') {
    const res = await fetch(
      `${CF_API}/zones/${zoneId}/security/events?since=${sinceTime}&limit=50`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const data = await res.json() as any;
    const events = data.result ?? [];
    const summary = events.reduce((acc: Record<string, number>, e: any) => {
      acc[e.action] = (acc[e.action] ?? 0) + 1;
      return acc;
    }, {});
    return JSON.stringify({ total: events.length, by_action: summary, sample: events.slice(0, 5) });
  }

  // traffic — use GraphQL Analytics API
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequests1mGroups(
          limit: 30
          filter: { datetime_geq: "${sinceTime}" }
          orderBy: [datetime_ASC]
        ) {
          dimensions { datetime }
          sum { requests, bytes, cachedRequests }
          avg { sampleInterval }
          uniq { uniques }
        }
      }
    }
  }`;

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json() as any;
  const groups = data.data?.viewer?.zones?.[0]?.httpRequests1mGroups ?? [];
  return JSON.stringify({ data_points: groups.length, traffic: groups });
}

export const cloudflareTool = {
  name: 'query_cloudflare',
  description:
    'Query live Cloudflare data for the Kick zone. Use this to check traffic patterns, firewall events, and zone health during an incident.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query_type: {
        type: 'string',
        enum: ['traffic', 'firewall_events', 'zone_health'],
        description: 'What to query: traffic analytics, recent firewall events, or overall zone health.',
      },
      since: {
        type: 'string',
        description: 'ISO 8601 timestamp to query from. Defaults to 30 minutes ago.',
      },
    },
    required: ['query_type'],
  },
};
