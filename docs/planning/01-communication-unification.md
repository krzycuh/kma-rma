# Communication Unification Analysis

**Status:** Planning
**Priority:** High (should be done before adding new metrics)
**Estimated Complexity:** Medium

## Current State

### Communication Patterns

The application currently uses **two different communication patterns**:

#### 1. REST API Polling (Currently Implemented)
- **CPU & RAM Metrics**: `GET /api/metrics` + `GET /api/history?limit=60`
  - Polling interval: 3 seconds (frontend)
  - Backend collection: 2 seconds
  - Returns snapshot + 60 historical samples

- **Container Stats**: `GET /api/containers`
  - Polling interval: 5 seconds (frontend)
  - Returns current stats for all containers

#### 2. Server-Sent Events / SSE (Partially Implemented)
- **Container Logs**: `GET /api/containers/:id/logs?follow=1`
  - Intended for streaming logs in real-time
  - **STATUS: Not fully implemented** (missing files)
    - Backend: `dockerLogs.ts` - missing
    - Frontend: `LogViewer.tsx` - missing
  - Route exists in `apiRoutes.ts:88` but calls non-existent function
  - Imported in `TopContainers.tsx:2` but component doesn't exist

### Architecture Details

```
┌─────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                        │
└─────────────────────────────────────────────────────────────┘

Frontend Polling (REST):
  App.tsx
    ├── Every 3s → GET /api/metrics          (latest snapshot)
    ├── Every 3s → GET /api/history?limit=60 (60 samples)
    └── TopContainers.tsx
          └── Every 5s → GET /api/containers (container stats)

Frontend SSE (Planned but incomplete):
  TopContainers.tsx
    └── LogViewer (missing) → SSE /api/containers/:id/logs

Backend:
  MetricsService
    ├── Polls every 2s (METRICS_POLL_INTERVAL_MS)
    ├── Stores 300 samples (METRICS_HISTORY_SIZE)
    └── Serves via REST endpoints
```

---

## Problem Statement

### Issues with Current Mixed Approach

1. **Inconsistency**
   - Different patterns for different data types confuses architecture
   - Makes codebase harder to maintain and understand
   - New developers must learn both patterns

2. **Incomplete Implementation**
   - SSE infrastructure is referenced but not implemented
   - Dead imports in production code
   - Unclear whether to use REST or SSE for new features

3. **Efficiency Concerns**
   - REST polling: Multiple HTTP requests per second
   - Each poll requires:
     - 2 requests (metrics + history)
     - Full HTTP overhead (headers, connection, parsing)
     - Client-side timing management

4. **Scalability**
   - Adding network metrics → another REST endpoint to poll?
   - Adding more metrics → more endpoints, more requests
   - N metrics = N polling intervals to manage

5. **Real-time Responsiveness**
   - REST polling has inherent delay (up to 3 seconds lag)
   - SSE provides instant updates when data changes
   - Critical for real-time monitoring dashboard

---

## Options Analysis

### Option A: **All REST (Remove SSE)**

**Approach:** Remove all SSE references, standardize on REST polling

**Pros:**
- ✅ Simple and straightforward
- ✅ Well-understood pattern
- ✅ Easy to debug (standard HTTP)
- ✅ Works with any HTTP client
- ✅ No connection management needed

**Cons:**
- ❌ Inefficient for high-frequency updates
- ❌ Multiple concurrent polling loops
- ❌ Wasted bandwidth on unchanged data
- ❌ Higher latency (polling interval)
- ❌ Poor for real-time logs streaming
- ❌ Scales poorly with more metrics

**Verdict:** ⚠️ **Not Recommended** - Moving backwards, inefficient for real-time monitoring

---

### Option B: **All SSE (Unified Streaming)**

**Approach:** Migrate all metrics to Server-Sent Events

**Implementation:**
```typescript
// Single SSE endpoint for all real-time data
GET /api/stream?token=xxx

// Server pushes updates:
event: metrics
data: {"ts": 123, "cpu": {...}, "memory": {...}, "network": {...}}

event: containers
data: [{"id": "abc", "name": "app", ...}]

event: container-log
data: {"id": "abc", "line": "log message"}
```

**Pros:**
- ✅ Single persistent connection
- ✅ True real-time updates (no polling delay)
- ✅ Server controls push frequency
- ✅ Efficient bandwidth usage
- ✅ Consistent architecture
- ✅ Natural fit for monitoring dashboards
- ✅ Browser handles reconnection automatically
- ✅ Easy to add new metrics (just new event types)

**Cons:**
- ❌ More complex server implementation
- ❌ Connection state management required
- ❌ Debugging slightly harder than REST
- ❌ Need to handle reconnection logic
- ❌ SSE not supported in very old browsers (not a concern for modern monitoring)

**Verdict:** ✅ **Recommended for real-time monitoring dashboard**

---

### Option C: **Hybrid (REST + SSE for Different Purposes)**

**Approach:** Use REST for snapshots/history, SSE for real-time updates

**Pattern:**
```
REST:
  GET /api/health              → Config info
  GET /api/history?limit=N     → Historical data
  GET /api/containers          → Container list snapshot

SSE:
  GET /api/stream              → Real-time metrics updates
  GET /api/containers/:id/logs → Log streaming
```

**Pros:**
- ✅ Best of both worlds
- ✅ REST for request/response patterns
- ✅ SSE for continuous data streams
- ✅ Clear separation of concerns

**Cons:**
- ❌ Still maintaining two patterns
- ❌ Increased complexity
- ❌ Unclear which to use for new features

**Verdict:** 🤔 **Acceptable compromise** - but less clean than Option B

---

## Recommended Solution: **Option B - Unified SSE**

### Rationale

1. **This is a real-time monitoring dashboard** - SSE is designed for this exact use case
2. **Simplifies frontend** - Single connection, no polling management
3. **Efficient** - Server pushes only when data changes
4. **Scalable** - Adding network metrics doesn't add new connections
5. **Consistent** - One pattern for all real-time data

### Implementation Plan

#### Phase 1: Infrastructure
1. Create `backend/src/sse/streamManager.ts`
   - Manage active SSE connections
   - Handle authentication
   - Track connected clients

2. Create `backend/src/sse/events.ts`
   - Define event types (metrics, containers, logs)
   - Serialization helpers

3. Create SSE endpoint `GET /api/stream`
   - Establish connection with proper headers
   - Send initial state
   - Set up event listeners

#### Phase 2: Migrate Metrics
1. Update `MetricsService` to emit events
   - When new sample collected → emit 'metrics' event
   - Broadcast to all connected clients

2. Update frontend `App.tsx`
   - Replace `fetch` polling with SSE connection
   - Listen for 'metrics' events
   - Maintain local state for history/sparklines

#### Phase 3: Migrate Containers
1. Update container stats collection
   - Emit 'containers' event when stats update

2. Implement `dockerLogs.ts` properly
   - Stream logs as 'container-log' events

3. Create `LogViewer.tsx` component
   - Listen to SSE for log events
   - Buffer and display in real-time

#### Phase 4: Clean Up
1. Remove old polling code
2. Remove `/api/metrics` and `/api/containers` endpoints
3. Keep `/api/history` for historical queries (or migrate to initial SSE payload)

---

## Technical Considerations

### Connection Management
- **Automatic reconnection**: Browser handles SSE reconnection automatically
- **Keep-alive**: Send periodic heartbeat events (e.g., every 30s)
- **Cleanup**: Remove dead connections on error/close

### Authentication
- Pass token in initial connection: `GET /api/stream?token=xxx`
- Validate once on connection establishment
- Close connection if token invalid

### Error Handling
- Frontend: Retry with exponential backoff
- Backend: Gracefully handle client disconnects
- Log connection errors for debugging

### Backward Compatibility
- Could temporarily support both REST and SSE
- Deprecate REST endpoints after SSE proven stable

### Performance
- Current: 2 requests every 3s = ~40 requests/minute per client
- SSE: 1 connection, ~20 events/minute (as data updates)
- Savings: ~50% reduction in HTTP overhead

---

## Migration Strategy

### Low-Risk Incremental Migration

**Week 1: SSE Infrastructure**
- Implement SSE manager and endpoint
- Test with single metric type (e.g., CPU)
- Keep REST endpoints active

**Week 2: Frontend Migration**
- Update App.tsx to use SSE
- Fall back to REST on SSE failure
- Validate data consistency

**Week 3: Container Stats**
- Migrate container stats to SSE
- Implement log streaming properly

**Week 4: Cleanup**
- Remove REST polling
- Remove old endpoints (or mark deprecated)
- Update documentation

---

## Success Metrics

- ✅ Single SSE connection replaces all polling
- ✅ Real-time updates (< 100ms latency from collection to display)
- ✅ Reduced HTTP requests by 80%+
- ✅ Easier to add new metrics (just new event types)
- ✅ All tests passing
- ✅ No regression in functionality

---

## Alternative: Quick Win (If Timeline Pressured)

If SSE migration is too large, **minimum viable unification**:

1. Keep REST for metrics
2. Properly implement SSE only for container logs (as originally intended)
3. Document clear pattern: "REST for polling data, SSE for streaming logs"
4. Ensure all new metrics follow REST pattern until SSE migration planned

This maintains current state but completes the partial SSE implementation.

---

## Recommendation

**Proceed with Option B (Unified SSE)** - This is the architecturally sound choice for a real-time monitoring dashboard. The migration can be done incrementally with low risk.

However, if timeline is critical for network metrics, consider the "Quick Win" approach:
1. Complete the container logs SSE implementation
2. Add network metrics via REST (matching existing pattern)
3. Schedule full SSE migration as separate project

**Decision required:** Do you want to:
- A) Migrate to unified SSE before adding network metrics (better long-term)
- B) Stick with REST, add network metrics quickly, plan SSE for later (faster short-term)
