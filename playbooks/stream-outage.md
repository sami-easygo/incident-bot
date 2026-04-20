# Playbook: Stream Outage

## Symptoms
- Viewers unable to connect to or watch streams
- High error rates on stream ingestion endpoints
- Broadcasters reporting streams not going live
- Spike in support volume around streaming

## Investigation Steps

### 1. Check Cloudflare for edge-level signals
- Look for traffic drop or spike on stream-related paths (`/live`, `/hls`, ingest endpoints)
- Check firewall events — mass blocks may indicate DDoS hitting legitimate traffic
- Check error rate at edge — 5xx surge without origin degradation = edge/routing issue

### 2. Check Datadog for origin health
- `kick.stream.ingest.error_rate` — if >5%, origin is degraded
- `kick.stream.viewer.connection_errors` — viewer-side signal
- Check "Stream Ingestion Health" monitor state
- Review recent deploy markers — correlate incident start time with any deploys

### 3. Distinguish DDoS vs origin failure

| Signal | DDoS | Origin Failure |
|--------|------|----------------|
| Cloudflare request volume | Very high | Normal or low |
| Cloudflare blocks | High | Low |
| Origin error rate | Normal | High |
| Latency at origin | Normal | Elevated |

## Resolution Paths

### DDoS
1. Enable "Under Attack" mode in Cloudflare for stream zones
2. Review and tighten firewall rules for ingest/viewer endpoints
3. Check if specific IPs or ASNs are the source — add targeted blocks
4. Escalate to Cloudflare support if volumetric (>100Gbps)

### Origin Failure
1. Check service health in ECS/EC2 for stream processing services
2. If deploy-correlated → initiate rollback
3. If not deploy-correlated → check DB connections, downstream dependencies
4. Page Sami or Yoshi if root cause unclear after 10 minutes

## Escalation
- Sami Alakus — full incident resolution authority
- Yoshi — full incident resolution authority
