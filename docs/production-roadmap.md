# Production Roadmap

This file is the source of truth for production hardening tasks in this repository.

## Execution rules for Codex

1. Execute tasks strictly in order: P0 -> P1 -> P2 -> P3 -> P4.
2. Do not start the next task until the current one is complete and validated.
3. Keep diffs narrowly scoped to the current task.
4. Do not refactor unrelated code.
5. Preserve existing behavior unless the task explicitly changes it.
6. After each task, summarize:
   - what changed
   - files changed
   - validation performed
   - remaining risks
   - follow-up tasks

## Definition of done

- task requirements implemented
- no unrelated changes
- relevant tests added or updated
- relevant validation passes
- docs updated if config or behavior changed

---

# P0 Critical hotfixes

## P0-01 Remove insecure JWT fallback

**Goal**  
Eliminate insecure fallback JWT secret from backend config.

**Scope**
- backend/config.py
- any startup/config bootstrap files
- .env.example
- README or deployment docs if present

**Requirements**
- Remove any hardcoded fallback JWT secret.
- Backend must fail on startup if JWT secret is missing.
- Error message must clearly indicate which env var is required.
- Update env example and docs.

**Acceptance criteria**
- App does not start without JWT_SECRET.
- App starts successfully when JWT_SECRET is present.
- No default secret remains anywhere in repo.

**Tests**
- Add config test verifying missing JWT_SECRET raises startup/config error.
- Add config test verifying explicit JWT_SECRET loads correctly.

---

## P0-02 Disable auto-created default admin user in production

**Goal**  
Prevent automatic creation of insecure default admin credentials.

**Scope**
- backend/server.py
- backend startup/bootstrap logic
- docs

**Requirements**
- Remove automatic creation of admin@store.com / admin123 during normal startup.
- If local bootstrap is still needed, move it to a dedicated dev-only script or CLI command.
- Production startup must not create any user implicitly.

**Acceptance criteria**
- Starting the backend in production mode does not create admin user.
- Optional dev bootstrap is explicit and documented.

**Tests**
- Add test proving startup does not create default admin.
- If bootstrap command exists, add test for explicit bootstrap path.

---

## P0-03 Remove demo credentials from frontend login screen

**Goal**  
Stop exposing insecure demo credentials in UI.

**Scope**
- frontend/app/(auth)/login.tsx
- related auth UI files if needed

**Requirements**
- Remove visible demo credentials from login screen.
- Keep UX clear without leaking credentials.
- Do not change login API behavior.

**Acceptance criteria**
- No demo username/password shown anywhere in UI.
- Login screen still works normally.

**Tests**
- Add component test ensuring demo credentials are not rendered.

---

## P0-04 Align frontend services CRUD payload with backend schema

**Goal**  
Fix broken service create/update flows caused by field mismatch.

**Scope**
- frontend/app/(tabs)/products.tsx
- frontend types/interfaces for service entities
- frontend API mapping
- backend schemas only if strictly required

**Requirements**
- Frontend must send backend-compatible fields:
  - name
  - description
  - service_type
  - base_price
- Fix edit modal to read base_price instead of price where appropriate.
- Ensure create and update both work.

**Acceptance criteria**
- Creating a service succeeds.
- Editing a service preserves existing values and updates correctly.
- No stale price/base_price mismatch remains.

**Tests**
- Add frontend unit test for service payload mapping.
- Add backend API test for create/update service if missing.

---

## P0-05 Fix category delete typo bug

**Goal**  
Repair broken category deletion request path.

**Scope**
- frontend/app/(tabs)/products.tsx

**Requirements**
- Replace incorrect entity key/path usage for category deletion.
- Verify delete action calls correct backend endpoint.

**Acceptance criteria**
- Category delete request uses /categories/{id}.
- UI refreshes correctly after delete.

**Tests**
- Add test covering category delete request target.

---

## P0-06 Add centralized ObjectId validation

**Goal**  
Prevent malformed Mongo ObjectId input from causing 500 errors.

**Scope**
- backend shared helpers/utilities
- all route handlers that parse ObjectId from path/query/body

**Requirements**
- Create a reusable helper for ObjectId parsing.
- Invalid ids must return HTTP 400 with clear message.
- Replace ad hoc ObjectId(...) calls in route handlers.

**Acceptance criteria**
- Invalid ids no longer cause 500.
- API consistently returns 400 for malformed ids.

**Tests**
- Add route tests for invalid product/order/user/category ids.

---

## P0-07 Add centralized API exception handling

**Goal**  
Standardize unexpected error handling and reduce opaque 500 responses.

**Scope**
- backend app initialization
- exception handler module
- response schema if needed

**Requirements**
- Add global exception handlers for:
  - validation errors
  - HTTP exceptions
  - unexpected exceptions
- Return consistent JSON error shape.
- Log unexpected exceptions server-side.

**Acceptance criteria**
- All handled errors use consistent response format.
- Unexpected exceptions are logged and return generic safe message.

**Tests**
- Add tests for validation and generic exception cases.

---

# P1 Stabilization and modularization

## P1-01 Extract backend routes and domain logic from monolithic server.py

**Goal**  
Replace the current monolithic backend entrypoint with modular structure.

**Scope**
- backend/server.py
- new modules under:
  - backend/api/routes/
  - backend/core/
  - backend/schemas/
  - backend/services/
  - backend/repositories/ if needed minimally

**Requirements**
- Keep public API behavior unchanged.
- Move route groups into separate modules:
  - auth
  - users
  - categories
  - products
  - services
  - orders
  - deliveries
  - reports
- Keep startup wiring in a minimal app entrypoint.

**Acceptance criteria**
- server.py or main.py is thin and focused on app creation.
- Route registration works exactly as before.
- No endpoint regression.

**Tests**
- Run full backend API regression tests.
- Add smoke test for app startup and route registration.

---

## P1-02 Introduce service layer for order creation and stock updates

**Goal**  
Move business logic out of route handlers into explicit services.

**Scope**
- backend orders routes
- backend/services/order_service.py
- backend/services/inventory_service.py

**Requirements**
- Extract order total calculation, stock checks, stock updates, and payment initialization from routes.
- Routes should orchestrate HTTP only.
- Keep database access behavior unchanged in this task.

**Acceptance criteria**
- Order route handlers become thin.
- Business logic is reusable and unit-testable.

**Tests**
- Add unit tests for order total calculation and stock validation.

---

## P1-03 Move dashboard summary calculations from frontend to backend

**Goal**  
Eliminate heavy client-side dashboard aggregation.

**Scope**
- backend new endpoint for dashboard summary
- frontend dashboard screen
- frontend API layer

**Requirements**
- Create backend endpoint returning dashboard summary:
  - total revenue
  - pending orders
  - low stock count
  - pending deliveries
- Frontend dashboard must consume this endpoint instead of loading full datasets just to calculate summary cards.
- Keep role behavior compatible with existing auth model.

**Acceptance criteria**
- Dashboard initial load uses summary endpoint.
- Frontend no longer fetches full orders/products for summary cards only.
- Summary values match current behavior.

**Tests**
- Backend API test for summary endpoint.
- Frontend test for dashboard data mapping.

---

## P1-04 Replace in-memory sales summary calculation with Mongo aggregation pipeline

**Goal**  
Fix reporting scalability bottleneck.

**Scope**
- backend reporting endpoint(s)
- report service if created

**Requirements**
- Remove large to_list(10000) style reporting logic for sales summary.
- Use Mongo aggregation pipeline for sums/counts/grouping.
- Preserve existing response shape unless change is explicitly documented.

**Acceptance criteria**
- Reporting endpoint no longer loads large order sets into Python memory for aggregation.
- Report results match prior logic.

**Tests**
- Add report API tests covering totals and grouping.

---

## P1-05 Standardize paginated API responses

**Goal**  
Improve consistency and frontend pagination reliability.

**Scope**
- backend list endpoints
- frontend consumers for paginated endpoints

**Requirements**
- Return envelope:
  - items
  - total
  - skip
  - limit
  - has_more
- Update frontend consumers accordingly.
- Apply to major collection endpoints:
  - products
  - orders
  - deliveries
  - users if paginated

**Acceptance criteria**
- Frontend pagination works with explicit metadata.
- No endpoint still relies on array-length heuristics where envelope is implemented.

**Tests**
- Backend tests for pagination metadata.
- Frontend tests for has_more behavior.

---

## P1-06 Extract API and data logic from screens into feature hooks

**Goal**  
Reduce screen complexity and improve testability.

**Scope**
- frontend features for:
  - products
  - orders
  - deliveries
  - dashboard

**Requirements**
- Move direct axios calls out of screen components.
- Create focused hooks such as:
  - useProducts
  - useOrders
  - useDeliveries
  - useDashboardSummary
- Keep UI behavior unchanged.

**Acceptance criteria**
- Main screens are thinner and mostly render state/UI.
- Data fetching logic is reusable and testable.

**Tests**
- Add hook tests or component integration tests for data states.

---

# P2 Reliability and consistency

## P2-01 Make order creation and stock updates atomic

**Goal**  
Prevent partial writes and inventory corruption during order creation.

**Scope**
- backend/services/order_service.py
- backend/services/inventory_service.py
- Mongo transaction/session handling or atomic update strategy

**Requirements**
- Ensure order creation and stock deduction happen atomically.
- If one item fails, no partial stock deduction remains.
- Keep behavior correct under concurrent requests.

**Acceptance criteria**
- Failed order creation does not leave stock partially updated.
- Concurrent orders cannot oversell stock due to read-modify-write race.

**Tests**
- Add tests for rollback behavior.
- Add concurrency-oriented test or simulated double-order stock race test.

---

## P2-02 Introduce guarded stock decrement operations

**Goal**  
Prevent race conditions in inventory updates even outside full transaction paths.

**Scope**
- backend inventory update logic

**Requirements**
- Use atomic conditional update patterns for stock decrement.
- Reject operation when stock is insufficient at update time.
- Centralize the logic in inventory service.

**Acceptance criteria**
- No route performs naive read-modify-write stock decrement directly.
- Insufficient stock is detected safely at write time.

**Tests**
- Add unit/API tests for guarded decrement logic.

---

## P2-03 Replace AsyncStorage token persistence with secure storage

**Goal**  
Improve mobile auth security.

**Scope**
- frontend auth store
- storage abstraction
- login/logout/session restore flows

**Requirements**
- Store access token in secure storage suitable for Expo/React Native.
- Preserve existing login/logout UX.
- Migrate storage access behind an abstraction.

**Acceptance criteria**
- Token is no longer stored in plain AsyncStorage.
- Session restore still works.

**Tests**
- Add tests for secure storage adapter behavior.

---

## P2-04 Create shared authorization matrix

**Goal**  
Stop scattering role logic across route handlers and screens.

**Scope**
- backend auth/permissions helpers
- frontend role gate helpers
- affected routes/screens as needed

**Requirements**
- Define permission map for:
  - owner
  - manager
  - seller
  - driver
- Replace scattered ad hoc role checks with shared helpers.
- Keep behavior unchanged unless current behavior is clearly buggy.

**Acceptance criteria**
- Role logic is readable and centralized.
- No repeated inline permission logic for core flows.

**Tests**
- Add permission tests for major protected actions.

---

## P2-05 Introduce soft delete for critical entities

**Goal**  
Preserve business history and prevent destructive deletes from damaging reporting.

**Scope**
- backend entities likely needing soft delete:
  - products
  - services
  - categories if safe
  - users depending on current business rules

**Requirements**
- Add deleted/archived semantics where destructive delete is risky.
- Exclude soft-deleted entities from default active queries.
- Preserve historical references in orders/reports.

**Acceptance criteria**
- Historical data remains valid after entity deactivation.
- UI can hide archived entities by default.

**Tests**
- Add tests for active vs archived query behavior.

---

# P3 Production readiness and ops

## P3-01 Add logging, request ids, and health endpoints

**Goal**  
Improve debugging and deployment diagnostics.

**Scope**
- backend app bootstrap
- logging config
- middleware
- health endpoints

**Requirements**
- Add request logging with request id.
- Add /health and /ready endpoints.
- Log unexpected exceptions with trace context.
- Avoid logging secrets.

**Acceptance criteria**
- Operators can distinguish healthy vs misconfigured app state.
- Requests are traceable in logs.

**Tests**
- Add tests for health endpoints.

---

## P3-02 Add CI workflow for lint, typecheck, tests

**Goal**  
Prevent regressions from landing unvalidated.

**Scope**
- .github/workflows/
- package scripts / python scripts as needed

**Requirements**
- CI must run:
  - backend tests
  - frontend tests
  - lint
  - typecheck
- Fail build on validation failure.
- Keep workflow clear and minimal.

**Acceptance criteria**
- Repo has a working CI pipeline on pull requests.
- Validation scripts are documented.

---

## P3-03 Document production environment and deployment contract

**Goal**  
Make production deploy reproducible.

**Scope**
- README
- DEPLOYMENT.md
- .env.example
- optional Dockerfile / compose if appropriate

**Requirements**
- Document required env vars.
- Document startup steps for backend and frontend.
- Document secrets that must never have defaults.
- Document bootstrap steps for first admin creation if still needed.

**Acceptance criteria**
- New developer or operator can deploy from docs without guessing.

---

## P3-04 Add critical flow smoke tests

**Goal**  
Cover the core business path with minimal but meaningful end-to-end checks.

**Scope**
- test harness appropriate to repo
- backend and/or frontend smoke tests

**Requirements**
- Cover at least:
  - login
  - create product/service
  - create order
  - payment add
  - delivery status update
- Keep tests lean and deterministic.

**Acceptance criteria**
- Core happy path is validated in automation.

---

# P4 Optional but highly recommended

## P4-01 Extract payment records into dedicated domain model

**Goal**  
Prepare system for real payment integrations and reconciliation.

**Scope**
- backend order/payment schemas
- payment service
- reporting logic
- frontend payment UI if needed

**Requirements**
- Move toward explicit payment entity or structured subdomain.
- Support transaction reference / provider reference fields.
- Preserve historical compatibility as much as possible.

**Acceptance criteria**
- Payment operations are traceable and extensible.

---

## P4-02 Create optimized read models for dashboard and reports

**Goal**  
Decouple operational writes from reporting reads.

**Scope**
- backend reporting/dashboard modules
- optional precomputed summary collections if justified

**Requirements**
- Keep write paths clean.
- Optimize frequent reads separately from transactional flows.

**Acceptance criteria**
- Reporting no longer competes heavily with operational endpoints.

---

## P4-03 Prepare offline-tolerant driver workflow

**Goal**  
Support real-world delivery usage in mobile conditions.

**Scope**
- frontend driver flows
- backend delivery state sync
- conflict handling if needed

**Requirements**
- Cache pending delivery actions locally.
- Sync safely when connection resumes.
- Prevent duplicate status updates.

**Acceptance criteria**
- Driver workflow remains usable with intermittent network.