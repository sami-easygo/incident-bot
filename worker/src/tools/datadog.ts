const DD_API = 'https://api.datadoghq.com/api/v1';

export async function queryDatadog(
  apiKey: string,
  appKey: string,
  queryType: 'metrics' | 'monitors' | 'logs',
  options: { query?: string; from?: number; to?: number; filter?: string }
): Promise<string> {
  const headers = {
    'DD-API-KEY': apiKey,
    'DD-APPLICATION-KEY': appKey,
    'Content-Type': 'application/json',
  };

  const now = Math.floor(Date.now() / 1000);
  const from = options.from ?? now - 30 * 60;
  const to = options.to ?? now;

  if (queryType === 'metrics') {
    const query = options.query ?? 'avg:system.cpu.user{*}';
    const res = await fetch(
      `${DD_API}/query?from=${from}&to=${to}&query=${encodeURIComponent(query)}`,
      { headers }
    );
    const data = await res.json() as any;
    return JSON.stringify({
      metric: query,
      series: data.series?.map((s: any) => ({
        metric: s.metric,
        points: s.pointlist?.slice(-10),
        aggr: s.aggr,
      })),
    });
  }

  if (queryType === 'monitors') {
    const filter = options.filter ?? '';
    const res = await fetch(
      `${DD_API}/monitor?name=${encodeURIComponent(filter)}&with_downtimes=false`,
      { headers }
    );
    const monitors = await res.json() as any[];
    return JSON.stringify(
      monitors
        .filter((m) => m.overall_state !== 'OK')
        .map((m) => ({ id: m.id, name: m.name, state: m.overall_state, message: m.message }))
    );
  }

  // logs
  const res = await fetch('https://api.datadoghq.com/api/v2/logs/events/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: {
        query: options.filter ?? 'status:error',
        from: new Date(from * 1000).toISOString(),
        to: new Date(to * 1000).toISOString(),
      },
      page: { limit: 25 },
      sort: '-timestamp',
    }),
  });
  const data = await res.json() as any;
  return JSON.stringify({ count: data.data?.length, logs: data.data?.slice(0, 10) });
}

export const datadogTool = {
  name: 'query_datadog',
  description:
    'Query live Datadog data. Use this to check metrics, alerting monitor states, and recent error logs during an incident.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query_type: {
        type: 'string',
        enum: ['metrics', 'monitors', 'logs'],
        description: 'What to query.',
      },
      query: {
        type: 'string',
        description: 'For metrics: the Datadog metric query string (e.g. "avg:kick.stream.ingest.error_rate{*}").',
      },
      filter: {
        type: 'string',
        description: 'For monitors: filter by name. For logs: filter query string.',
      },
      from: {
        type: 'number',
        description: 'Unix timestamp to query from. Defaults to 30 minutes ago.',
      },
      to: {
        type: 'number',
        description: 'Unix timestamp to query to. Defaults to now.',
      },
    },
    required: ['query_type'],
  },
};
