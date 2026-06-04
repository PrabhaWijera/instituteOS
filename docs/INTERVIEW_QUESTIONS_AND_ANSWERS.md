# instituteOS — Interview Questions & Answers

> **Use with:** `docs/PROJECT_INTERVIEW_GUIDE.md`  
> **Project:** Multi-tenant tuition institute management platform (NexClass / instituteOS)  
> **Live:** https://instituteos.fly.dev | API: https://instituteos-api.fly.dev

Read the question, try answering yourself, then compare with the model answer.

---

## Section A — Project Overview (Must Know)

### Q1. What is instituteOS / NexClass?

**Answer:**  
instituteOS is a **web-based institute management platform** I built for tuition centers. It connects **five roles** — Super Admin, Institute Admin, Teacher, Student, and Parent — in one system. Admins manage people and classes; teachers run **OTP + GPS attendance** and upload materials; students mark attendance and pay fees; parents monitor their child read-only. It includes **automated billing**, an **AI tutor** (Groq), email invites, and a full **observability stack**. It is deployed live on **Fly.io** with **Neon PostgreSQL**.

---

### Q2. Who is this product for?

**Answer:**  
Primary users are **private tuition institutes in Sri Lanka** (grades 6–13, A/L). Secondary users: platform operator (Super Admin) managing many institutes, teachers running daily classes, students/parents tracking attendance and fees. The UI uses **LKR currency**, Sri Lankan grade labels, and bilingual AI tutor support.

---

### Q3. What problem did you solve?

**Answer:**  
Institutes were using **paper attendance**, **WhatsApp for fees**, and **Excel for records**. That causes fraud (fake attendance), lost payments, no parent visibility, and no audit trail. I built one system where attendance is **OTP + GPS verified**, fees are **automated with reminders and suspension**, and every action is **logged in PostgreSQL** with role-based access.

---

### Q4. What is your role in this project?

**Answer (adapt to your truth):**  
I designed and implemented the **full stack** — Express API with Prisma, Next.js frontend, database schema, authentication, attendance system, billing worker, deployment to Fly.io, and testing (Vitest, Playwright, k6). I also set up observability (Prometheus, Grafana, Sentry) and fixed production issues (CORS, JWT cookies, OTP validation, geolocation).

---

### Q5. What are the main features?

**Answer:**  
1. Multi-tenant institute management  
2. Invite-based user onboarding (48h tokens)  
3. Student verification workflow (profile → admin verify)  
4. Class CRUD with teacher assignment and enrollment  
5. **OTP + geofencing attendance** with live WebSocket board  
6. Manual attendance override for teachers  
7. Automated billing cron (dues, grace period, suspend)  
8. Payment recording (UNPAID → PAYMENT_READY → PAID)  
9. PDF/material uploads via Cloudinary  
10. AI tutor chat (Groq)  
11. In-app + email notifications  
12. Parent portal (read-only)  
13. GDPR data export/delete  
14. Swagger API docs, metrics, tracing  

---

### Q6. Is this project live? How do users access it?

**Answer:**  
Yes. Production runs on **Fly.io**:
- Frontend: `https://instituteos.fly.dev` (custom domain: `instituteos.ddnsking.com`)
- API: `https://instituteos-api.fly.dev/api`
- Database: **Neon** PostgreSQL (managed, serverless)
- Local dev: Docker Compose + Nginx at `http://localhost`

---

### Q7. Why did you choose this tech stack?

**Answer:**  
- **TypeScript end-to-end** — fewer runtime bugs, shared types  
- **PostgreSQL + Prisma** — relational billing/enrollment data needs ACID  
- **Next.js** — fast dashboards, App Router, good SEO for landing page  
- **Redis (Upstash)** — login lockout, OTP cache without self-hosting Redis  
- **Fly.io** — simple HTTPS deploy for both frontend and API  
- **Cloudinary** — no file storage ops  
- **Groq** — fast/cheap LLM for AI tutor  

---

## Section B — Live System Process (How It Works End-to-End)

### Q8. Walk me through what happens when a student marks attendance live.

**Answer:**  
1. **Teacher** opens Attendance → Start Session → picks class → `POST /api/v1/attendance/sessions`  
2. Backend generates **6-digit OTP**, saves to `attendance_sessions.otp_code` and Redis  
3. Teacher screen shows OTP; WebSocket connects to `ws://.../ws/attendance?token=&sessionId=`  
4. **Student** opens Attendance → selects **enrolled class** → enters OTP  
5. Browser gets **GPS coordinates** (latitude/longitude)  
6. `POST /api/v1/attendance/verify-otp` with `{ otpCode, classId, latitude, longitude }`  
7. Backend: find ONGOING session → verify OTP (DB source of truth) → Haversine geofence check → check enrollment not suspended → create `attendance_records` row  
8. WebSocket broadcasts to teacher: student name, check-in time, present count  
9. Student sees success; teacher live board updates  

**If fee overdue:** enrollment `SUSPENDED` → 403 "Attendance blocked"  
**If wrong OTP:** 400 "Invalid OTP code"  
**If outside geofence:** 403 with distance in meters  

---

### Q9. Walk me through student onboarding from zero.

**Answer:**  
1. **Admin** registers student (name, email, grade, optional class) → `POST /students`  
2. System creates inactive User + Student (`PENDING_PROFILE`) + UserInvite  
3. Email sent: "Get Started" link → `/invite?token=...`  
4. Student sets password → account active  
5. If parent email provided → Parent user + ParentStudentLink + parent invite email  
6. Student logs in → Settings → fills DOB, address, parent info  
7. Student submits for verification → `PENDING_VERIFICATION`  
8. Admin verifies in person → `VERIFIED`  
9. Admin enrolls in classes (or was done at registration) → billing dates set  

---

### Q10. Walk me through the billing cycle live.

**Answer:**  
1. Student enrolled → `StudentEnrollment` with `nextBillingDate` and status `ACTIVE`  
2. **Billing worker** runs on cron (`BILLING_CRON`, e.g. every 10 min or daily)  
3. When `nextBillingDate <= now`: creates `PaymentDue` (UNPAID), sets enrollment `PAYMENT_DUE`, notifies student  
4. Student sees fee in My Fees → can mark `PAYMENT_READY` (ready to pay at counter)  
5. Admin/Teacher records payment → `POST /payments/:id/record` → PAID, enrollment back to ACTIVE  
6. After `gracePeriodDays` + `autoSuspendAfterDays` (institute settings) → `SUSPENDED` → blocks attendance  

---

### Q11. What happens when a user logs in (live request flow)?

**Answer:**  
1. Browser `POST /api/v1/auth/login` with email/password  
2. Express: helmet → CORS check → rate limit → sanitize → validate Zod  
3. `auth.service.login`: find user, bcrypt compare, Redis lockout check, institute active check  
4. Sign JWT access (15m) + refresh (7d), store refresh in DB  
5. Set **httpOnly cookie** `refreshToken` (SameSite=None in prod for cross-origin)  
6. Return JSON `{ user, accessToken }`  
7. Frontend stores access token in **sessionStorage**, Zustand sets user  
8. Redirect to `/dashboard`  
9. On next API call: `Authorization: Bearer <token>`  
10. On 401: axios interceptor calls `/auth/refresh` with cookie → new access token  

---

### Q12. How does the parent get access?

**Answer:**  
When a student completes invite acceptance and the student record has `parentEmail`, the system **upserts a PARENT user** and creates `ParentStudentLink`. Parent gets invite email → sets password → logs in → redirected to `/children` (not admin dashboard). All parent APIs are read-only under `/api/v1/parent/children/*`.

---

## Section C — Architecture & Design

### Q13. Explain your system architecture in 30 seconds.

**Answer:**  
Three-tier: **Next.js frontend** on Fly.io talks HTTPS to **Express API** on Fly.io. API uses **Prisma** to **Neon PostgreSQL** for all persistent data, **Upstash Redis** for cache/lockout/OTP, **Cloudinary** for files, **Groq** for AI, **SMTP** for email. Real-time attendance uses **WebSocket** on the same Node server. Observability: Prometheus metrics, Grafana dashboards, Jaeger traces, Sentry errors.

---

### Q14. Why modular monolith instead of microservices?

**Answer:**  
For this scale, a **modular monolith** is simpler to develop, test, and deploy. Each domain (auth, attendance, payment) is a separate folder with routes/controller/service. We can extract workers (billing) or WebSocket to separate services later if load grows. Fly.io runs one backend machine today — microservices would add network overhead without benefit yet.

---

### Q15. What is multi-tenancy and how did you implement it?

**Answer:**  
Multiple institutes share one app instance but **data is isolated** by `instituteId`. Every institute-scoped query filters by the JWT's `instituteId`. Super Admin is the only role that operates cross-tenant. Institute deactivation blocks all its users at auth middleware level (Redis-cached institute status check).

---

### Q16. What design patterns did you use?

**Answer:**  
- **MVC-like:** Controller → Service → Prisma  
- **Repository pattern:** Prisma as data access layer  
- **Middleware chain:** auth, RBAC, validation, rate limit  
- **Circuit breaker:** Groq and Cloudinary external calls  
- **Bulkhead:** limit concurrent AI/upload requests  
- **Graceful degradation:** Redis down → OTP from PostgreSQL  
- **Soft delete:** `isDeleted` flag instead of hard delete  
- **Invite token pattern:** onboarding without open registration  

---

## Section D — Authentication & Security

### Q17. Why JWT + refresh token instead of sessions?

**Answer:**  
JWT access tokens are **stateless** for API verification (fast, no DB lookup every request). Refresh tokens are **stored in DB + httpOnly cookie** so we can revoke them on logout/password change. Short access token (15m) limits damage if stolen from memory; refresh token is not accessible to JavaScript (XSS protection).

---

### Q18. How do you prevent brute-force login?

**Answer:**  
Redis tracks failed attempts per user (`login_attempts:{userId}`). After **5 failures in 15 minutes**, account is locked (`lockout:{userId}`). IP-based rate limiting on `/auth/login` via express-rate-limit. Passwords hashed with **bcrypt** (12 rounds).

---

### Q19. How does RBAC work?

**Answer:**  
JWT payload contains `role` and `instituteId`. `requireRole('TEACHER', 'INSTITUTE_ADMIN')` middleware checks role before controller runs. Frontend sidebar `getNavItems(role)` shows different menus. Defense in depth: frontend hides UI, backend enforces on every route.

---

### Q20. What security headers and protections do you have?

**Answer:**  
- **Helmet** — security HTTP headers  
- **CORS** — whitelist origins from `CORS_ORIGINS`  
- **Input sanitization** middleware — XSS prevention  
- **Zod validation** — reject malformed payloads  
- **Rate limiting** — global + login + per-user (AI: 20/min)  
- **PII redaction** in logs (password, token, otp fields)  
- **File validation** middleware for uploads  
- **Institute status check** on every authenticated request  

---

### Q21. How do you handle CORS in production with separate frontend/API domains?

**Answer:**  
Frontend at `instituteos.fly.dev`, API at `instituteos-api.fly.dev`. Backend `CORS_ORIGINS` lists allowed origins. Axios uses `withCredentials: true` for refresh cookie. Refresh cookie uses `SameSite=None; Secure` in production so cross-origin cookie is sent.

---

### Q22. What is GDPR support in your project?

**Answer:**  
- `GET /users/me/data-export` — user downloads all their data  
- `DELETE /users/me` — self-service account deletion  
- `DELETE /users/:id/data` — Super Admin erasure  
- **Retention worker** nightly: purges old AI chats, notifications, expired tokens  

---

## Section E — Attendance System (Deep Dive)

### Q23. Why OTP + GPS instead of just clicking "Present"?

**Answer:**  
Click-only attendance can be marked from home. **OTP** proves the student attended the live class (teacher displays code). **GPS geofencing** proves physical presence near the institute (Haversine formula vs institute lat/lng within configurable radius, default 1000m). Together they reduce proxy attendance fraud.

---

### Q24. Explain the Haversine formula in your project.

**Answer:**  
`backend/src/utils/haversine.ts` calculates distance in meters between student coordinates and institute coordinates. Compared against `geofenceRadiusMeters` from `InstituteSettings`. If distance > radius → 403 with message showing how many meters away. `BYPASS_GEOFENCING=true` skips this for dev/testing.

---

### Q25. Why store OTP in both Redis and PostgreSQL?

**Answer:**  
PostgreSQL is **source of truth** (always available). Redis is **fast cache** with TTL matching OTP expiry. If Redis fails or returns wrong type, verification still works from DB. I fixed a production bug where Redis returned numeric OTP vs string comparison failure — now DB is checked first.

---

### Q26. How does the live attendance board work?

**Answer:**  
Teacher connects WebSocket to `/ws/attendance?token=JWT&sessionId=UUID`. Server validates JWT, registers client in `sessionClients` Map. When student verifies OTP, `broadcastAttendance()` sends JSON to all clients for that sessionId. Teacher UI updates present count and student list without page refresh.

---

### Q27. Can a student see all classes or only enrolled ones?

**Answer:**  
**Only enrolled classes.** `class.controller.findAll` for STUDENT role calls `findForStudent(studentId)` — filters classes where active enrollment exists. This prevents students from marking attendance for classes they don't belong to.

---

## Section F — Database & Prisma

### Q28. What are the most important tables?

**Answer:**  
- `institutes` + `institute_settings` — tenant config  
- `users` — all login accounts with role  
- `students` — profile linked 1:1 to user  
- `tuition_classes` — classes with fee, schedule, teacher  
- `student_enrollments` — student ↔ class + billing status  
- `attendance_sessions` + `attendance_records` — OTP sessions and check-ins  
- `payment_dues` — fee records per billing period  
- `user_invites` — onboarding tokens  
- `parent_student_links` — parent ↔ child  
- `refresh_tokens` — JWT refresh rotation  

---

### Q29. Explain the student verification status flow.

**Answer:**  
Enum: `PENDING_PROFILE` → student must fill details → `PENDING_VERIFICATION` → admin reviews → `VERIFIED`. Until verified, certain fields are locked. Admin can verify only after student submits. This mirrors real institutes verifying identity in person.

---

### Q30. What is soft delete and where do you use it?

**Answer:**  
Instead of `DELETE FROM users`, set `isDeleted=true`. Preserves attendance/payment audit history. Used on User, Student, TuitionClass, Institute. Queries filter `isDeleted: false`. UI says "Remove" not "Delete permanently."

---

### Q31. Why PostgreSQL over MongoDB?

**Answer:**  
Data is highly **relational**: enrollments link students to classes, payments link to enrollments, attendance links to sessions and students. We need **transactions** (billing creates PaymentDue + updates enrollment atomically). PostgreSQL + Prisma handles this cleanly.

---

## Section G — Frontend (Next.js)

### Q32. How is the frontend structured?

**Answer:**  
Next.js 15 **App Router**. `(auth)` group for login/invite (public). `(dashboard)` group for protected pages with layout that redirects unauthenticated users. State: **Zustand** for auth, **Axios** for API. UI: Tailwind + Radix components. Role-based sidebar in `sidebar.tsx`.

---

### Q33. How does the frontend handle authentication persistence?

**Answer:**  
Access token in **sessionStorage** (survives refresh). `AuthProvider` calls `fetchMe()` on load. Axios interceptor refreshes on 401 using httpOnly cookie. Dashboard layout checks `isAuthenticated` from Zustand.

---

### Q34. Why did the parent login redirect back to login page (bug you fixed)?

**Answer:**  
Parent dashboard used `window.location.href = '/children'` which caused **full page reload**, wiping in-memory token before sessionStorage fix. Fixed with `router.replace('/children')` and sessionStorage token persistence.

---

## Section H — DevOps, Deployment & Observability

### Q35. How did you deploy to production?

**Answer:**  
1. Created Fly.io apps: `instituteos` (frontend), `instituteos-api` (backend)  
2. `fly secrets set` for DATABASE_URL, JWT, Redis, Cloudinary, Groq, SMTP, CORS  
3. `fly deploy` from backend/frontend directories (Dockerfile builds)  
4. `docker-entrypoint.sh` runs Prisma migrations + seeds super admin  
5. Custom domain via `fly certs add instituteos.ddnsking.com`  

---

### Q36. What is in your Docker Compose local stack?

**Answer:**  
Nginx (port 80), frontend (3000), backend (4000), PostgreSQL (5432), Prometheus, Grafana, Loki, Jaeger, Alertmanager. One command `docker compose up` for full local dev matching production patterns.

---

### Q37. What metrics do you expose?

**Answer:**  
`GET /api/metrics` — Prometheus format. HTTP request duration/count, billing cycles processed, attendance events, OTP expirations. Grafana dashboards in `observability/grafana/provisioning/dashboards/`. Health endpoint returns circuit breaker states (207 if degraded).

---

### Q38. What happens when Groq AI is down?

**Answer:**  
**Circuit breaker** opens after failures. AI route returns graceful error instead of hanging. Bulkhead limits concurrent AI requests to 10. User sees error toast; rest of app works.

---

## Section I — Testing

### Q39. What testing did you do?

**Answer:**  
- **Vitest** — API integration tests (auth, attendance, enrollment, payment, security/XSS)  
- **Playwright** — E2E per role (admin, teacher, student, parent flows)  
- **k6** — load test ~25 concurrent users, health + login endpoints  
- **CI** — GitHub Actions runs lint + test + build on push  

---

### Q40. Give an example of a security test you wrote.

**Answer:**  
`security.test.ts` tests XSS injection in login fields returns safe 401, not 500. Tests RBAC — student cannot access admin routes. Tests authenticated routes require valid JWT and active institute.

---

## Section J — Behavioral / STAR Questions

### Q41. Tell me about a difficult bug you fixed.

**Answer (STAR):**  
**Situation:** Users reported login failed in browser but API worked in Postman.  
**Task:** Find why production login broken.  
**Action:** Traced CORS errors, found `FRONTEND_URL` had comma-separated origins used in email links; fixed split for CORS vs FRONTEND_URL. Added `trust proxy` for rate limit behind Nginx. Fixed baked wrong API URL in Next.js build args.  
**Result:** Login works on live site; documented env separation (`FRONTEND_URL` vs `CORS_ORIGINS`).

---

### Q42. Tell me about a time you made a trade-off.

**Answer:**  
**Billing worker inside API process** vs separate queue (RabbitMQ). Chose cron in Node for simplicity at current scale. Configurable schedule and billing cycle. Can extract to BullMQ when enrollment count grows. Trade-off: simpler deploy vs less isolation.

---

### Q43. How would you scale this to 10,000 students?

**Answer:**  
- Horizontal Fly.io machines + load balancer  
- PostgreSQL read replicas for reports  
- Redis cluster for OTP/lockout  
- Move billing to dedicated worker with job queue  
- CDN for frontend static assets  
- WebSocket sticky sessions or Redis pub/sub (native Redis, not Upstash REST)  
- Database indexes on enrollment, session lookups  
- Connection pooling (already configured in Prisma URL)  

---

## Section K — Quick-Fire Technical Questions

| # | Question | Short Answer |
|---|----------|--------------|
| 44 | What port does the API run on? | 4000 |
| 45 | API version path? | `/api/v1/*` |
| 46 | Access token expiry? | 15 minutes (configurable) |
| 47 | Refresh token expiry? | 7 days |
| 48 | Invite link expiry? | 48 hours |
| 49 | OTP length? | 6 digits |
| 50 | Default geofence radius? | 1000 meters |
| 51 | Login lockout threshold? | 5 attempts / 15 min |
| 52 | ORM used? | Prisma 5 |
| 53 | Password hashing? | bcrypt, 12 rounds |
| 54 | File upload service? | Cloudinary |
| 55 | AI model? | Groq llama-3.3-70b-versatile |
| 56 | State management? | Zustand |
| 57 | HTTP client? | Axios with interceptors |
| 58 | WebSocket path? | `/ws/attendance` |
| 59 | Swagger docs URL? | `/api/docs` |
| 60 | Super admin seed? | `prisma/seed.ts` + docker-entrypoint |

---

## Section L — "Tricky" Questions Interviewers Ask

### Q61. What happens if two students submit the same OTP at the same time?

**Answer:**  
Both can succeed if both are valid enrolled students — OTP is shared for the class session, not per student. Each creates a separate `attendance_records` row with unique `(sessionId, studentId)` constraint. Second submit by **same** student gets 409 "Already marked."

---

### Q62. Can a teacher mark attendance for another teacher's class?

**Answer:**  
No. `startSession` checks `tuitionClass.teacherId === teacherId`. Manual mark requires teacher role on that session's class.

---

### Q63. What if institute has no GPS coordinates set?

**Answer:**  
Geofence check throws 400 "Institute location not set. Contact your admin." Admin must set lat/lng in Settings → Campus Info. Or `BYPASS_GEOFENCING=true` for testing.

---

### Q64. Difference between deactivate and delete user?

**Answer:**  
**Deactivate** (`isActive=false`) — user cannot login, data preserved, reversible. **Delete/Remove** (`isDeleted=true`) — soft delete, email freed for re-registration, audit data kept.

---

### Q65. How do API errors reach the frontend?

**Answer:**  
`ApiError` class in services → `error.middleware.ts` formats `{ success: false, message }` → Axios catch → toast.error in UI. 401 triggers refresh interceptor.

---

## Section M — Questions YOU Should Ask the Interviewer

1. What does your team use for auth — JWT, sessions, or OAuth?  
2. How do you handle multi-tenancy in your product?  
3. What's your approach to background jobs — cron, queues, or serverless?  
4. How is observability set up — metrics, tracing, alerting?  
5. What does your CI/CD pipeline look like?  

---

## Section N — 60-Second Elevator Pitch

> "I built instituteOS, a full-stack platform for tuition institutes with five roles — from platform admin down to parents. Teachers start live OTP attendance sessions; students verify with a code and GPS geofencing so they can't mark attendance from home. There's automated monthly billing with fee reminders and suspension, an AI tutor powered by Groq, and invite-based onboarding over email. I used Express, Prisma, PostgreSQL, Next.js, Redis, and deployed it live on Fly.io with Prometheus and Sentry. I also wrote Vitest, Playwright, and k6 tests."

---

## Section O — CV One-Liner

**instituteOS** — Full-stack multi-tenant SaaS for tuition institutes (5 roles, OTP+GPS attendance, automated billing, AI tutor); Express, Prisma, PostgreSQL, Next.js, Redis, Fly.io.

---

*Last updated: project state as deployed on Fly.io with Neon PostgreSQL.*
