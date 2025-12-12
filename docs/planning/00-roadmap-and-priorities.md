# KMA-RMA Enhancement Roadmap & Priorities

**Document Version:** 1.0
**Last Updated:** 2025-12-12
**Status:** Planning Phase

---

## Executive Summary

This document outlines the prioritized roadmap for three major enhancements to the KMA-RMA (Raspberry Pi Management Application):

1. **CI/CD Pipeline** - Automated testing, building, and deployment
2. **Communication Pattern Unification** - Standardize on REST or SSE for metrics
3. **Network Usage Metrics** - Track internet bandwidth usage across all interfaces

**Recommended Priority Order:**
```
1. CI/CD Implementation (HIGHEST - do first)
   ↓
2. Communication Unification (HIGH - architectural foundation)
   ↓
3. Network Metrics Implementation (MEDIUM - feature addition)
```

---

## Priority Analysis

### Priority 1: CI/CD Implementation 🔴 **HIGHEST**

**Rationale:**
- ✅ **Enables faster subsequent development** - Automated quality checks catch issues early
- ✅ **Reduces deployment friction** - Pre-built Docker images for Raspberry Pi
- ✅ **Establishes quality baseline** - Linting and type checking prevent regressions
- ✅ **Low risk, high value** - Doesn't modify application code, only adds automation
- ✅ **Foundation for refactoring** - Makes communication unification safer
- ✅ **Multi-platform builds** - Generates arm64 images for Raspberry Pi automatically

**Key Benefits:**
- Every PR validated automatically
- No more manual builds on resource-constrained Raspberry Pi
- Version-controlled releases with semantic versioning
- Faster iteration cycles for future features

**Dependencies:** None - can be implemented immediately

**Risk Level:** Low

**Documentation:** [03-cicd-implementation.md](./03-cicd-implementation.md)

---

### Priority 2: Communication Unification 🟠 **HIGH**

**Rationale:**
- ✅ **Architectural consistency** - Single pattern easier to maintain
- ✅ **Prerequisite for scaling** - Adding more metrics easier with unified approach
- ✅ **Fixes incomplete implementation** - SSE container logs currently broken
- ✅ **Performance benefits** - SSE reduces polling overhead
- ✅ **Real-time responsiveness** - Instant updates vs. polling delay

**Key Benefits:**
- Cleaner codebase with one communication pattern
- Better performance (fewer HTTP requests)
- True real-time monitoring dashboard
- Easier to add network metrics after unification

**Dependencies:**
- Should be done **after CI/CD** (so refactoring is validated)
- Should be done **before network metrics** (so new feature uses correct pattern)

**Risk Level:** Medium (involves architectural changes)

**Documentation:** [01-communication-unification.md](./01-communication-unification.md)

---

### Priority 3: Network Metrics 🟡 **MEDIUM**

**Rationale:**
- ✅ **User-requested feature** - Direct user requirement
- ✅ **Low complexity** - Follows existing pattern for CPU/RAM
- ✅ **No configuration needed** - Auto-discovers all interfaces
- ✅ **Valuable metric** - Completes system monitoring picture

**Key Benefits:**
- Bandwidth usage visibility
- Historical trends via sparklines
- Aggregate across all network interfaces
- Matches existing dashboard aesthetic

**Dependencies:**
- **Recommended:** Implement after communication unification decision
- **Acceptable:** Can be done with current REST pattern if urgency high

**Risk Level:** Low (straightforward feature addition)

**Documentation:** [02-network-metrics.md](./02-network-metrics.md)

---

## Decision Matrix

| Enhancement | Value | Effort | Risk | Dependencies | Priority |
|-------------|-------|--------|------|--------------|----------|
| **CI/CD** | Very High | Low | Low | None | 🔴 **1st** |
| **Communication Unification** | High | Medium | Medium | After CI/CD | 🟠 **2nd** |
| **Network Metrics** | Medium | Low | Low | After communication decision | 🟡 **3rd** |

---

## Recommended Implementation Path

### 🎯 **Path A: Ideal (Recommended)**

**Timeline: 2-3 weeks**

```
Week 1: CI/CD Foundation
├── Day 1-2: Setup linting (ESLint for backend/frontend)
├── Day 3-4: Create CI workflow + test locally
├── Day 4-5: Create deploy workflow + test release
└── Day 5-7: Documentation, validation, first release

Week 2: Communication Unification
├── Day 1-2: Implement SSE infrastructure (streamManager, events)
├── Day 3-4: Migrate metrics to SSE (CPU, RAM)
├── Day 5-6: Implement container logs SSE + LogViewer
└── Day 7: Testing, cleanup, remove old REST polling

Week 3: Network Metrics
├── Day 1-2: Implement backend (procNetDev.ts, collector integration)
├── Day 3-4: Frontend UI (network card, sparklines)
├── Day 5: Testing on Raspberry Pi
└── Day 6-7: Polish, documentation, release v1.1.0
```

**Outcome:**
- Production-ready CI/CD pipeline
- Unified SSE architecture (scalable, real-time)
- Complete system monitoring (CPU, RAM, Network, Containers)
- Clean, maintainable codebase

---

### ⚡ **Path B: Fast Track (If Timeline Critical)**

**Timeline: 1 week**

```
Days 1-2: CI/CD (minimal)
├── Setup basic linting
├── Create CI workflow (lint + build only)
├── Create deploy workflow
└── First release to GHCR

Days 3-4: Network Metrics (using REST pattern)
├── Implement procNetDev.ts
├── Integrate with existing collector
├── Frontend network card
└── Test on Raspberry Pi

Days 5-7: Partial SSE Implementation
├── Complete container logs SSE (as originally planned)
├── Create LogViewer component
└── Document REST vs SSE usage pattern
```

**Outcome:**
- Basic CI/CD functional
- Network metrics working (REST pattern)
- Container logs working (SSE pattern)
- Hybrid architecture documented

**Trade-offs:**
- Leaves mixed communication patterns (REST + SSE)
- Will need future refactoring for full unification
- Less comprehensive testing/linting in CI

**Future Work:**
- Full SSE migration scheduled as separate project

---

### 🚫 **Path C: Not Recommended**

Adding network metrics **without** CI/CD first:

**Problems:**
- No automated validation of changes
- Manual builds on Raspberry Pi (slow)
- Risk of breaking existing functionality
- Harder to roll back if issues occur
- Subsequent CI/CD setup may reveal issues

---

## Detailed Roadmap

### Phase 1: CI/CD Implementation ✅

**Goal:** Establish automated pipeline for quality and deployment

| Task | Estimated Effort | Files Modified |
|------|------------------|----------------|
| Setup ESLint backend | 1 hour | `backend/.eslintrc.json`, `backend/package.json` |
| Verify ESLint frontend | 30 min | `frontend/.eslintrc.json` |
| Create CI workflow | 30 min | `.github/workflows/ci.yml` |
| Create deploy workflow | 30 min | `.github/workflows/deploy.yml` |
| Update Dockerfile | 15 min | `Dockerfile` |
| Test locally | 1 hour | - |
| Create test release | 30 min | - |
| Documentation | 30 min | `README.md` |
| **Total** | **~5 hours** | **6 files** |

**Success Criteria:**
- [ ] CI runs on every push/PR
- [ ] Deploy workflow publishes to GHCR on release
- [ ] Multi-platform image (amd64, arm64) available
- [ ] Image runs successfully on Raspberry Pi

**Deliverables:**
- Working CI/CD pipeline
- Published Docker image: `ghcr.io/krzycuh/kma-rma:v1.0.0`
- Deployment documentation

---

### Phase 2: Communication Unification ✅

**Goal:** Standardize on SSE for all real-time metrics

#### Option A: Full SSE Migration (Recommended)

| Task | Estimated Effort | Files Modified |
|------|------------------|----------------|
| Create SSE manager | 2 hours | `backend/src/sse/streamManager.ts` |
| Create event types | 1 hour | `backend/src/sse/events.ts` |
| Create `/api/stream` endpoint | 1 hour | `backend/src/routes/apiRoutes.ts` |
| Update MetricsService to emit events | 1 hour | `backend/src/metrics/service.ts` |
| Migrate frontend to SSE | 2 hours | `frontend/src/App.tsx` |
| Implement dockerLogs.ts | 1 hour | `backend/src/metrics/dockerLogs.ts` |
| Create LogViewer.tsx | 1 hour | `frontend/src/components/LogViewer.tsx` |
| Testing & refinement | 2 hours | - |
| Remove old REST endpoints | 30 min | `backend/src/routes/apiRoutes.ts` |
| **Total** | **~11.5 hours** | **7 files** |

**Success Criteria:**
- [ ] Single SSE connection replaces all polling
- [ ] Real-time metrics updates (< 100ms latency)
- [ ] Container logs streaming works
- [ ] Reduced HTTP requests by 80%+
- [ ] All tests passing

**Deliverables:**
- Unified SSE architecture
- Working container logs viewer
- Updated API documentation

#### Option B: Minimal (Quick Win)

| Task | Estimated Effort |
|------|------------------|
| Implement dockerLogs.ts only | 1 hour |
| Create LogViewer.tsx | 1 hour |
| Document REST vs SSE pattern | 30 min |
| **Total** | **~2.5 hours** |

**Trade-off:** Maintains mixed architecture, defers full unification

---

### Phase 3: Network Metrics ✅

**Goal:** Add bandwidth monitoring for all network interfaces

| Task | Estimated Effort | Files Modified |
|------|------------------|----------------|
| Create procNetDev.ts | 1.5 hours | `backend/src/metrics/procNetDev.ts` |
| Update collector with network stats | 1 hour | `backend/src/metrics/collector.ts` |
| Update TypeScript types | 30 min | `backend/src/metrics/types.ts` |
| Create network card UI | 1.5 hours | `frontend/src/App.tsx` |
| Add format helper | 30 min | `frontend/src/utils/format.ts` (new) |
| Testing on Raspberry Pi | 1 hour | - |
| Documentation | 30 min | `README.md` |
| **Total** | **~6.5 hours** | **5 files** |

**Success Criteria:**
- [ ] Network metrics collected from all interfaces
- [ ] Download/upload rates displayed correctly
- [ ] Sparklines render historical trends
- [ ] Rates in appropriate units (B/s, KB/s, MB/s)
- [ ] Works with eth0 and wlan0

**Deliverables:**
- Network metrics dashboard card
- Historical trends via sparklines
- Complete system monitoring (CPU + RAM + Network)

---

## Total Effort Estimate

### Path A (Recommended - Ideal)
- **CI/CD**: ~5 hours
- **Communication (Full SSE)**: ~11.5 hours
- **Network Metrics**: ~6.5 hours
- **Total**: **~23 hours** (~3 days full-time, or 2-3 weeks part-time)

### Path B (Fast Track)
- **CI/CD**: ~5 hours
- **Communication (Minimal)**: ~2.5 hours
- **Network Metrics**: ~6.5 hours
- **Total**: **~14 hours** (~2 days full-time, or 1 week part-time)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| CI/CD multi-platform build fails | Low | High | Test locally with `docker buildx` first |
| SSE migration breaks existing features | Medium | High | Implement incrementally, keep REST fallback initially |
| Network stats parsing fails on some systems | Low | Medium | Graceful error handling, return null |
| Timeline pressure forces compromises | Medium | Medium | Use Path B if needed, schedule full migration later |
| User wants network metrics urgently | Low | Low | Can implement with REST first, migrate to SSE later |

---

## Questions to Answer

Before proceeding, clarify the following with the user:

### 1. Timeline Preference
- **Question:** Do you prefer **Path A** (ideal, ~3 weeks) or **Path B** (fast track, ~1 week)?
- **Impact:** Determines whether to do full SSE migration or defer it

### 2. Communication Pattern Decision
- **Question:** For communication unification, do you want:
  - **Option A:** Full SSE migration (better long-term, more work)
  - **Option B:** Quick fix (complete container logs only, defer full migration)
- **Impact:** Affects Phase 2 scope and timeline

### 3. Network Metrics Urgency
- **Question:** Is network metrics urgent, or can it wait for proper SSE architecture?
- **Impact:** If urgent, implement with REST first; if not, wait for SSE

### 4. Testing Requirements
- **Question:** Should we add comprehensive tests in CI/CD phase, or add them incrementally?
- **Impact:** Affects CI/CD phase effort (can add 2-4 hours if comprehensive)

---

## Recommendations

Based on the user's original statement:

> "I think CI/CD should be first - further implementation will go more efficiently"

### ✅ **Recommended Plan:**

1. **Implement CI/CD first** (Priority 1) - **User agrees**
2. **Decide on communication pattern** (Priority 2) - **Needs user input**
3. **Add network metrics** (Priority 3) - **After architectural foundation set**

### 💡 **Suggested Approach:**

**Week 1:**
- Implement CI/CD (Path A, Phase 1)
- Get first release published to GHCR
- **Decision point:** Does user want full SSE migration or quick SSE fix?

**Week 2:**
- If full SSE: Implement Phase 2 Option A
- If quick fix: Implement Phase 2 Option B + start network metrics

**Week 3:**
- Complete network metrics
- Polish, test, document
- Release v1.1.0 with complete monitoring

---

## Success Metrics

**After Phase 1 (CI/CD):**
- ✅ Automated builds on every PR
- ✅ Published images in GHCR
- ✅ Deployment via `docker pull` instead of manual builds

**After Phase 2 (Communication):**
- ✅ Single unified communication pattern
- ✅ Real-time metrics updates
- ✅ Container logs working
- ✅ Cleaner, more maintainable codebase

**After Phase 3 (Network Metrics):**
- ✅ Complete system visibility (CPU, RAM, Network, Containers)
- ✅ Professional monitoring dashboard
- ✅ Ready for additional features (alerting, notifications, etc.)

---

## Next Steps

1. **User Decision Required:**
   - Confirm CI/CD priority (assumed yes ✅)
   - Choose Path A (ideal) or Path B (fast track)
   - Choose communication Option A (full SSE) or B (minimal)
   - Confirm network metrics requirements (all interfaces, no config ✅)

2. **Implementation:**
   - Start with Phase 1 (CI/CD)
   - Create feature branch: `feature/cicd-pipeline`
   - Follow implementation guide in `03-cicd-implementation.md`

3. **Validation:**
   - Test CI workflow on PR
   - Create test release
   - Validate Docker image on Raspberry Pi

4. **Proceed to Phase 2:**
   - Based on user's choice of communication pattern
   - Create feature branch: `feature/sse-migration` or `feature/container-logs`

---

## Related Documents

- [01-communication-unification.md](./01-communication-unification.md) - Analysis of REST vs SSE
- [02-network-metrics.md](./02-network-metrics.md) - Network metrics implementation details
- [03-cicd-implementation.md](./03-cicd-implementation.md) - CI/CD setup guide

---

## Summary

**Priority Order:**
1. 🔴 **CI/CD** - Highest priority, enables everything else
2. 🟠 **Communication** - High priority, architectural foundation
3. 🟡 **Network Metrics** - Medium priority, feature addition

**Recommended Timeline:**
- **Path A (Ideal):** 2-3 weeks for complete implementation
- **Path B (Fast):** 1 week for basic functionality, defer refactoring

**Next Action:**
- **Get user confirmation on path selection**
- **Start CI/CD implementation immediately**

**User agreed:** "CI/CD should be first" ✅

---

*This roadmap will be updated as implementation progresses and requirements evolve.*
