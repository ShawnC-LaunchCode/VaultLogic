# Observability - Future Implementation

**Status:** Placeholder files for future implementation
**Impact:** No impact on current system
**Priority:** Low (future enhancement)

## Overview

This directory contains placeholder files for future observability integrations:
- **prom.ts** - Prometheus metrics (not yet implemented)
- **otel.ts** - OpenTelemetry tracing (not yet implemented)

## Current Status

These files are **NOT currently used** in the application:
- ❌ Not imported by any production code
- ❌ No `/metrics` endpoint is registered
- ❌ No telemetry is being collected
- ✅ No impact on application performance
- ✅ No dependencies required

## Why They Exist

These files serve as:
1. **Documentation** - Show planned observability architecture
2. **Code examples** - Provide implementation guidance for future work
3. **Type stubs** - Define interfaces for when implementation is added

## Future Implementation

### To Enable Prometheus Metrics

1. Install dependency:
   ```bash
   npm install prom-client
   ```

2. Implement metrics in `prom.ts`:
   - Counter: `vaultlogic_workflow_runs_total`
   - Histogram: `vaultlogic_workflow_run_duration_ms`
   - Gauge: `vaultlogic_active_workflow_runs`

3. Call `initPrometheus(app)` in `server/index.ts`

4. Set environment variable:
   ```
   PROMETHEUS_ENABLED=true
   ```

5. Configure Prometheus to scrape `http://your-server:port/metrics`

### To Enable OpenTelemetry Tracing

1. Install dependencies:
   ```bash
   npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
   ```

2. Implement tracing in `otel.ts`:
   - Initialize SDK with exporter (Jaeger, Zipkin, etc.)
   - Configure auto-instrumentation
   - Add custom spans for workflow operations

3. Call `initOpenTelemetry()` in `server/index.ts` before other imports

4. Set environment variables:
   ```
   OTEL_ENABLED=true
   OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4318
   ```

## Cleanup Decision (Nov 2025)

During codebase cleanup, we evaluated these files:
- **Decision:** Keep as documentation/placeholders
- **Reason:** Well-documented, no harm, useful for future implementation
- **Alternative considered:** Delete entirely (rejected - would remove useful guidance)

## Related Documentation

- `docs/STAGE_11_ANALYTICS_SLIS.md` - Analytics and SLI implementation (completed)
- Prometheus documentation: https://prometheus.io/
- OpenTelemetry documentation: https://opentelemetry.io/

## Notes

- The existing analytics system (Stage 11) handles application metrics via database
- Prometheus/OTel would add infrastructure-level metrics and distributed tracing
- Current priority is low since database analytics cover current needs
- Revisit when:
  - Multi-region deployment is needed
  - Distributed tracing becomes important
  - Infrastructure metrics are required for SRE
