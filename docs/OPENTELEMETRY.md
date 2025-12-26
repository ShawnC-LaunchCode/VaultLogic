# OpenTelemetry Instrumentation

VaultLogic includes comprehensive OpenTelemetry instrumentation for monitoring authentication metrics and system performance.

## Overview

The platform uses OpenTelemetry for observability with:
- **Prometheus exporter** for metrics collection
- **Auto-instrumentation** for Express.js, HTTP, and database calls
- **Custom metrics** for authentication events
- **Distributed tracing** capabilities

## Setup

### 1. Install Dependencies

The required dependencies are already in `package.json`:
```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-node": "^0.53.0",
  "@opentelemetry/auto-instrumentations-node": "^0.50.0",
  "@opentelemetry/exporter-prometheus": "^0.53.0"
}
```

Install with:
```bash
npm install
```

### 2. Enable Telemetry

Set environment variables:
```bash
# Enable telemetry (required in production, optional in development)
ENABLE_TELEMETRY=true

# Optional: Change metrics port (default: 9464)
METRICS_PORT=9464

# Optional: Protect /metrics endpoint with API key
METRICS_API_KEY=your-secret-key
```

### 3. Start Server

```bash
npm run dev
```

Metrics will be available at:
- **Local:** http://localhost:9464/metrics
- **Application:** http://localhost:5000/metrics

## Metrics Available

### Authentication Metrics

#### 1. Login Attempts Counter
**Metric:** `auth.login.attempts`
**Type:** Counter
**Labels:**
- `status`: success | failure | mfa_required | account_locked | email_not_verified | error
- `provider`: local | google | oauth

**Example:**
```
auth_login_attempts{status="success",provider="local"} 42
auth_login_attempts{status="mfa_required",provider="local"} 5
auth_login_attempts{status="failure",provider="local"} 8
```

#### 2. MFA Events Counter
**Metric:** `auth.mfa.events`
**Type:** Counter
**Labels:**
- `event`: enabled | disabled | verified | backup_code_used | backup_codes_regenerated | verification_failed | trusted_device_added | trusted_device_revoked

**Example:**
```
auth_mfa_events{event="enabled"} 15
auth_mfa_events{event="verified"} 120
auth_mfa_events{event="backup_code_used"} 3
```

#### 3. Session Operations Counter
**Metric:** `auth.session.operations`
**Type:** Counter
**Labels:**
- `operation`: created | refreshed | revoked | expired | password_reset_requested | password_reset_completed | email_verification_sent

**Example:**
```
auth_session_operations{operation="created"} 150
auth_session_operations{operation="refreshed"} 500
auth_session_operations{operation="revoked"} 20
```

#### 4. Auth Endpoint Latency Histogram
**Metric:** `auth.endpoint.duration`
**Type:** Histogram
**Unit:** milliseconds
**Labels:**
- `endpoint`: login | refresh | logout | mfa_verify
- `status`: 200 | 401 | 400 | 500 | error | success

**Example:**
```
auth_endpoint_duration_bucket{endpoint="login",status="200",le="10"} 5
auth_endpoint_duration_bucket{endpoint="login",status="200",le="50"} 35
auth_endpoint_duration_bucket{endpoint="login",status="200",le="100"} 80
auth_endpoint_duration_sum{endpoint="login",status="200"} 1250.5
auth_endpoint_duration_count{endpoint="login",status="200"} 100
```

#### 5. Active Sessions Gauge
**Metric:** `auth.sessions.active`
**Type:** ObservableGauge
**Description:** Current number of active sessions (auto-updated)

**Example:**
```
auth_sessions_active 245
```

## Accessing Metrics

### Without API Key Protection

```bash
curl http://localhost:5000/metrics
```

### With API Key Protection

If `METRICS_API_KEY` is set:

**Via Header:**
```bash
curl -H "x-api-key: your-secret-key" http://localhost:5000/metrics
```

**Via Query Parameter:**
```bash
curl http://localhost:5000/metrics?apiKey=your-secret-key
```

## Prometheus Configuration

Add this job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'vaultlogic'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    # If using API key:
    params:
      apiKey: ['your-secret-key']
```

## Grafana Dashboard

Create dashboards using these queries:

### Login Success Rate
```promql
rate(auth_login_attempts{status="success"}[5m])
/
rate(auth_login_attempts[5m])
```

### MFA Adoption Rate
```promql
auth_mfa_events{event="enabled"}
/
ignoring(event) auth_login_attempts{status="success"}
```

### Average Login Latency
```promql
rate(auth_endpoint_duration_sum{endpoint="login"}[5m])
/
rate(auth_endpoint_duration_count{endpoint="login"}[5m])
```

### Failed Login Attempts
```promql
increase(auth_login_attempts{status=~"failure|account_locked"}[1h])
```

### Active Sessions Over Time
```promql
auth_sessions_active
```

## Custom Metrics in Code

Use `MetricsService` to record custom events:

```typescript
import { metricsService } from '../services/MetricsService';

// Record login attempt
metricsService.recordLoginAttempt('success', 'local');

// Record MFA event
metricsService.recordMfaEvent('enabled', userId);

// Record session operation
metricsService.recordSessionOperation('created', userId);

// Record auth latency
const startTime = Date.now();
// ... auth operation ...
metricsService.recordAuthLatency(startTime, 'login', 200);

// Other helpers
metricsService.recordRegistration('success', 'local');
metricsService.recordPasswordReset('completed');
metricsService.recordEmailVerification('verified');
metricsService.recordTrustedDevice('added');
```

## Architecture

### File Structure

```
server/
├── observability/
│   └── telemetry.ts           # OpenTelemetry SDK initialization
├── services/
│   └── MetricsService.ts      # Custom metrics service
├── routes/
│   ├── auth.routes.ts         # Instrumented auth endpoints
│   └── metrics.ts             # Prometheus /metrics endpoint
└── index.ts                   # Telemetry initialization (FIRST)
```

### Initialization Order

**Critical:** OpenTelemetry MUST be initialized before any other imports:

```typescript
// server/index.ts
import dotenv from "dotenv";
dotenv.config();

// MUST BE FIRST - before Express, DB, etc.
import { initTelemetry } from "./observability/telemetry";
initTelemetry();

// Now import everything else
import express from "express";
// ...
```

This ensures auto-instrumentation can hook into all modules.

## Troubleshooting

### Metrics endpoint returns 503

**Problem:** Telemetry not initialized
**Solution:** Set `ENABLE_TELEMETRY=true` in `.env`

### No metrics showing up

**Problem:** Auto-instrumentation not working
**Solution:** Ensure `initTelemetry()` is called BEFORE other imports in `server/index.ts`

### Metrics endpoint requires authentication

**Problem:** `METRICS_API_KEY` is set
**Solution:** Pass API key via header or query parameter (see "Accessing Metrics")

### Active sessions gauge shows 0

**Problem:** Database query failing
**Solution:** Check logs for errors in `MetricsService` callback

## Performance Considerations

- **Minimal overhead:** OpenTelemetry adds <5ms latency
- **Non-blocking:** All metrics are recorded asynchronously
- **Error handling:** Metrics failures never crash the application
- **Memory efficient:** Prometheus exporter uses minimal memory

## Alerting Examples

Set up Prometheus alerts:

```yaml
groups:
  - name: auth_alerts
    interval: 1m
    rules:
      - alert: HighLoginFailureRate
        expr: |
          rate(auth_login_attempts{status="failure"}[5m]) > 0.2
        for: 5m
        annotations:
          summary: "High login failure rate detected"

      - alert: MFAVerificationFailures
        expr: |
          increase(auth_mfa_events{event="verification_failed"}[10m]) > 5
        annotations:
          summary: "Multiple MFA verification failures"

      - alert: SlowLoginEndpoint
        expr: |
          histogram_quantile(0.95,
            rate(auth_endpoint_duration_bucket{endpoint="login"}[5m])
          ) > 1000
        for: 5m
        annotations:
          summary: "Login endpoint p95 latency > 1s"
```

## Production Deployment

### Railway/Docker

Expose the metrics port:
```yaml
# railway.toml
[deploy]
healthcheck_path = "/health"

[build]
builder = "NIXPACKS"

[env]
ENABLE_TELEMETRY = "true"
METRICS_PORT = "9464"
```

### Kubernetes

Create a ServiceMonitor for Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: vaultlogic-metrics
spec:
  selector:
    matchLabels:
      app: vaultlogic
  endpoints:
    - port: metrics
      path: /metrics
      interval: 30s
```

## Security Best Practices

1. **Always use API key in production**
   ```bash
   METRICS_API_KEY=$(openssl rand -hex 32)
   ```

2. **Restrict metrics endpoint to internal network**
   - Use firewall rules
   - Or deploy separate metrics service

3. **Sanitize user IDs in labels**
   - Only use hashed/anonymized IDs
   - Current implementation includes userId for debugging

4. **Monitor metrics access**
   - Check logs for unauthorized access
   - Alert on failed authentication attempts

## References

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Prometheus Exporter](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/exporter-prometheus)
- [Auto-Instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
