# Load Testing with k6

## Prerequisites
Install k6: https://k6.io/docs/get-started/installation/

```bash
# macOS
brew install k6

# Windows (chocolatey)
choco install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

## Running Tests

### Health Check (basic throughput)
```bash
k6 run loadtest/health.js
```

### Auth Flow (realistic user journey)
```bash
k6 run -e BASE_URL=http://localhost:4000 -e TEST_EMAIL=admin@nexclass.com -e TEST_PASSWORD=changeme123 loadtest/auth-flow.js
```

### Against production (be careful!)
```bash
k6 run -e BASE_URL=https://api.nexclass.com loadtest/health.js
```

## Thresholds
- **Health endpoint**: p95 < 200ms, failure rate < 1%
- **Auth flow**: p95 < 500ms, failure rate < 5%

## Interpreting Results
- `http_req_duration`: Time per request (lower is better)
- `http_reqs`: Total requests per second (throughput)
- `vus`: Virtual users active at any given time
- `checks`: Pass/fail rate of assertions
