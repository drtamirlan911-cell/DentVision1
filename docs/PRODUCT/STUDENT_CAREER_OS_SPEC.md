# Student OS & Career OS — Product / Domain Specification

**Status:** ACTIVE IMPLEMENTATION SPECIFICATION  
**Date:** 2026-11-20  
**Normative parent:** `docs/DENTVISION_MASTER_SPEC.md` v5.0  
**Execution record:** `DENTVISION_EXECUTION_PLAN.md`

This document defines the personal learning and career journeys that connect Academy OS, Jobs and organization workspaces. It does not create a second identity system and does not replace the Master Spec.

## 1. Product law

Every person has one permanent DentVision identity and can participate in multiple independent workspaces:

- a student has a personal learning space even when they have no academy membership;
- a job seeker has a personal career space even when they have no employer membership;
- an academy owns course delivery, cohorts, teaching assignments and assessment operations;
- an employer owns vacancies, applications received, interviews, offers and hiring operations;
- the same person can be a student, lecturer, employer recruiter, job seeker, clinician and buyer without creating duplicate accounts.

**The person owns their history; the organization owns its operational workflow.** A course purchase, application or offer is linked to the person and the originating organization. Changing an organization context must not move or erase personal records.

Never represent a purchase, application, invitation, interview, job offer or signed employment contract as the same entity or a single generic status.

## 2. Student OS — personal learning workspace

Canonical routes:

- `/school` — public Academy discovery/catalogue;
- `/school/my-learning` — authenticated personal learning home;
- `/school/course/:id` — learning player / course detail;
- `/school/certificates` — credential wallet (may resolve to a tab in My Learning, but must not be a fake redirect).

### 2.1 Student home

The page must answer, in this order:

1. What can I continue right now?
2. What have I purchased or been granted?
3. What is due soon (cohort session, lesson, homework, assessment)?
4. What did I complete and what proof did I earn?
5. What did I pay, and what is still awaiting payment?

Primary areas:

- **Continue learning:** last opened course and next incomplete lesson.
- **My learning:** purchased, free, invited/granted, cohort and completed learning products.
- **Schedule:** upcoming live webinars, office / hands-on sessions and cohort meetings in the user's local timezone.
- **Tasks:** homework, submissions, tutor feedback, exam availability and due dates.
- **Progress:** course/module/lesson completion, assessment attempts and attendance.
- **Certificates:** issued, pending verification, revoked/expired only when supported by an audited reason.
- **Purchases:** payment state, order/receipt, refund state and entitlement state.
- **Saved:** wishlist and unfinished checkout, clearly distinguished from purchased learning.

Mobile starts with Continue Learning and upcoming tasks; it does not compress the desktop catalogue into tiny cards.

### 2.2 Purchase-to-learning contract

The learning entitlement state machine is:

`DISCOVERED → CHECKOUT_PENDING → PAID_CONFIRMED → ACTIVE → COMPLETED`

Additional controlled paths:

- `FREE_GRANTED → ACTIVE`;
- `INVITED → ACCEPTED → ACTIVE`;
- `ACTIVE → EXPIRED` when the purchased access period ends;
- `ACTIVE → SUSPENDED` only for a recorded legal, safety or refund reason;
- `PAID_CONFIRMED → REFUND_PENDING → REFUNDED` only after provider-confirmed refund evidence.

Rules:

- A pending payment never grants paid curriculum access.
- Access is granted only from a verified provider callback/settlement or an authorized free/invitation grant.
- Payment retries are idempotent. One person cannot acquire duplicate entitlements through retries.
- Every enrollment keeps a durable link to its course, issuer/academy, price/currency snapshot, purchase/payment reference, acquisition source, grant date and access policy.
- Course title, issuer, purchase facts, completed lessons, grades and certificates are historical records. Removing a course from public discovery or archiving an academy does not delete them.
- Course content is versioned. A student continues on the purchased version unless the academy publishes a migration and the learner can see the change.
- Refund/chargeback may change future entitlement, but does not silently erase progress, an already-earned credential or the purchase record. The correct legal and credential policy must decide any exceptional revocation.
- A purchased product is shown in My Learning even when the course is no longer publicly listed. It opens the student's authorized learning view or a clear archived-content state, never the seller's workspace.
- Access checks are enforced on the backend for course detail, lesson content, files, exams, homework, tutor context, video and certificate download; hiding a button is not authorization.

### 2.3 Learning player

One learning workspace per enrollment, not an Academy owner page:

- course identity, issuer, lecturer and purchased version;
- ordered modules and lessons with locked/unlocked state;
- video, text, downloadable material and clinical case content;
- durable lesson completion and resume position;
- homework submission and tutor/reviewer feedback;
- exam instructions, attempts, grade, pass mark and next attempt rules;
- session attendance and check-in for webinars / hands-on teaching;
- certificate rules, issuance evidence and public verification reference;
- accessibility, mobile playback, captions/materials, timezone and offline boundaries.

Progress must be server-owned and auditable. Client-side progress cannot issue a certificate. Certificate issuance requires the configured completion, attendance and assessment conditions; an exam pass alone must not invent an accredited qualification.

### 2.4 Academy owner workspace remains separate

Academy owner/administrator sees organization operations:

- programmes, courses, published versions and prerequisites;
- cohorts / intakes, capacity and enrolment roster;
- instructors, substitutions and teaching assignments;
- attendance, session delivery, homework review and assessment queue;
- learner support and permitted communications;
- certificate issuance queue and verification;
- sales, refunds, platform fees, lecturer shares, payout reconciliation;
- organization team, branches, legal verification, audit and analytics.

A lecturer sees only assigned courses/cohorts, assigned learners, reviews and their own earnings unless an additional scoped role authorizes broader academy operations. Students never see the academy's private learner notes, financial ledger, or other students' personal records.

## 3. Career OS — personal job seeker workspace

Canonical routes:

- `/jobs` — public vacancy discovery;
- `/career` — personal career command center;
- `/career/profile` — private professional profile and preferences;
- `/career/resumes` — resume versions and publication consent;
- `/career/applications` — applications sent by the candidate;
- `/career/invitations` — employer invitations to consider/apply;
- `/career/interviews` — scheduled interviews and candidate responses;
- `/career/offers` — formal job offers received;
- `/career/history` — closed, withdrawn and past processes.

The employer workspace remains separate at `/employer`.

### 3.1 Candidate command center

The candidate can always distinguish:

- **My application:** I sent this application to this exact vacancy at this employer on this date.
- **Employer invitation:** this employer discovered an eligible public resume and invited me to consider a vacancy or speak with them. It is not an application until I accept/submit it.
- **Interview:** a scheduled event linked to an application or a direct recruitment process, with time, timezone, format, location/meeting link and response state.
- **Job offer:** a versioned proposal with concrete role, compensation, work arrangement, start date, expiry and employer identity. Accepting it is not itself a signed employment contract.
- **Employment contract:** a separate legal artifact with its own document version, signatories, EDS/provider evidence, signing state, start/end terms and audit trail. Do not label an offer as a contract.

The source label and actor must be visible on every card and timeline event: candidate action, employer action, system notification or platform operation.

### 3.2 Application lifecycle and history

Canonical application states:

`SUBMITTED → RECEIVED → REVIEWING → INTERVIEW → OFFER → HIRED`

Terminal or side transitions:

- `REJECTED`, `WITHDRAWN`, `CLOSED`;
- an employer may return an application to review only through a permitted, audited transition;
- offer decline or expiry returns to a defined recruitment state; it must not falsify the candidate's historic application.

Every material transition produces an immutable `JobApplicationEvent` containing actor, timestamp, prior/new state, event type and candidate-visible explanation. Candidate-visible events are intentionally distinct from private recruiter notes. Employer names are resolved from the vacancy's employer Organization/clinic snapshot; a candidate must never see only a free-form company name or an ambiguous generic user name.

Closing or deleting a vacancy from public discovery does not erase applications. Existing candidates see “vacancy closed” while retaining the employer, vacancy title, submitted resume snapshot and application history.

### 3.3 Invitations

An invitation is created by an authorized recruiter from an active, verified employer context and is linked to a published open resume and optionally a specific vacancy.

Candidate actions:

- view employer's verified public profile, role, reason for invitation and expiry;
- accept / decline / let expire;
- on acceptance, proceed to the linked application or interview path;
- withdraw/disable resume discovery and control future contact preferences.

An invitation never reveals candidate private email, phone, private CV attachments or clinic records by default. A candidate's consent and accepted connection govern further disclosure.

### 3.4 Interviews

An interview is a durable record, not a status label. It includes:

- application / invitation / candidate and employer references;
- proposed time, timezone (IANA), duration and format;
- in-person address or meeting URL with access controls;
- agenda and permitted candidate-facing instructions;
- candidate response: pending, confirmed, declined, reschedule requested;
- cancellation/reschedule history, organizer and notification timestamps;
- completed / no-show outcome as separate facts.

Never silently move an interview when a timezone or calendar change occurs. Send an update and retain the prior event history.

### 3.5 Job offers and contracts

A formal offer must be immutable by version once sent. Changes create a replacement version and make the differences visible. It contains:

- verified employer Organization and authorized issuer;
- role/title, location, employment type and schedule;
- salary amount/range, currency and payment period;
- benefits / trial period / start date / validity deadline;
- attachments and document hashes where supported;
- candidate accept / decline / request clarification response;
- delivery, view and response timestamps.

Accepting an offer triggers the next contract preparation task; it must not mark the candidate as hired until the employer completes its authorized hiring transition and any required contract/signature evidence. Kazakhstan EDS/provider signature must be cryptographically/provider verified; a UI checkbox or uploaded unsigned PDF is not a signature.

## 4. Employer OS — organization-owned recruitment operations

The employer owns the other side of every event:

- vacancy creation, review, publication, editing, pausing and closure;
- candidate discovery limited to actively published resumes and consent;
- inbound applications with source and resume snapshot;
- organization-scoped pipeline, assignment and recruiter permissions;
- interview scheduling, timezones, reminders and rescheduling;
- versioned offers and expiry/response management;
- contract preparation, EDS/signature status and hiring completion;
- candidate communication and retention policy;
- recruitment analytics with funnel definitions and source attribution;
- audit log for every access to private candidate information and every status/offer action.

Recruiters should not receive owner finance, legal administration or unrelated employer data by default. Candidate exports, bulk search and contact disclosure require explicit permission and audit.

## 5. Canonical domain records

| Record | Owner of record | Purpose |
|---|---|---|
| Course / CourseVersion | Academy | Published content and immutable version |
| Enrollment / LearningEntitlement | Person + issuing academy | Purchase/grant/access and progress |
| LessonProgress / AssessmentAttempt | Person + enrollment | Durable learning evidence |
| Attendance | Person + cohort/session | Session participation |
| Certificate | Issuer + person | Verified credential |
| JobResume / CandidateProfile | Person | Candidate-owned professional data and consent |
| JobApplication | Candidate + vacancy | Candidate-initiated application |
| JobApplicationEvent | Application | Immutable visible/private event history |
| JobInvitation | Employer + candidate | Employer-initiated invitation |
| JobInterview | Employer + candidate + application/invitation | Scheduled selection event |
| JobOffer | Employer + candidate | Formal versioned employment proposal |
| EmploymentContract | Employer + person | Separate signed employment instrument |

The current repository already has `Course`, `SchoolEnrollment`, `JobVacancy`, `JobApplication`, `Organization`, `Notification` and audit foundations. New records are additive. Do not duplicate users, courses, vacancies, employer organizations or generic notifications to simulate these domains.

## 6. Security and privacy invariants

- A candidate reads only their own applications, invitations, interviews, offers, resume visibility and documents.
- An employer reads only its own vacancy pipeline. A clinic/employer A cannot enumerate employer B's applicants or candidate messages.
- An employer can discover only public, open resumes; sensitive contact data is disclosed only after an explicit, auditable candidate consent/connection.
- An invitation's opaque ID is not authorization. Every endpoint checks the authenticated candidate / organization owner.
- Candidate events contain only candidate-safe explanations. Internal recruiter notes remain separate and are not returned by candidate APIs.
- Paid course curriculum requires a verified, active learning entitlement; a pending payment or guessed course ID is insufficient.
- Progress updates, test scores and attendance must reference the user's own enrollment and a real lesson/session in the correct course version.
- Certificates are issued by server-side rules, have a stable verification ID and cannot be forged by passing arbitrary `completed=true` from the browser.
- Personal history is retained according to the published retention/legal policy; account deletion, consent withdrawal and employer archive follow explicit, auditable workflows.
- Notifications are pointers to scoped records, not a way to bypass access checks.

## 7. Definition of Done / acceptance gates

### Student
1. A person without any clinic or academy membership can purchase or receive a free/granted course under one DentVision identity.
2. Pending payment does not unlock paid content; confirmed payment produces exactly one active entitlement.
3. The purchased course appears at `/school/my-learning` and after logout/login, device change and organization switch.
4. The student can resume, complete lessons, submit homework, sit permitted exams and view the result history.
5. Completion requirements issue the correct certificate once; direct API calls cannot forge progress or another student's certificate.
6. Removing a course from public catalogue or archiving the academy preserves the student's paid history and authorized course view.
7. Refund/chargeback updates entitlement according to policy without deleting historical purchase/progress evidence.

### Candidate
1. A job seeker sees every submitted application with explicit “You applied” origin, employer identity, vacancy snapshot and date.
2. Employer status changes create a candidate-visible timeline event and notification.
3. An employer invitation is clearly distinct from an application and identifies the inviter.
4. A candidate can accept/decline invitation, interview and offer only for their own records.
5. Candidate can view complete interview details and versioned offers; accepting an offer does not falsely create a signed contract.
6. Closed vacancies, employers and archived organizations remain correctly represented in past applications.
7. Another candidate cannot read this person's resume-private data, applications, offers or interview links.

### Organization and platform
1. Academy owner, lecturer, student, employer owner, recruiter and job seeker each receive the correct role-specific workspace and data scope.
2. Organization A/B isolation and candidate/employer negative-IDOR tests pass.
3. Every money, employment, content access, invitation, assessment and signature transition is auditable and idempotent.
4. Web desktop, tablet, mobile and Android provide coherent personal journeys.
5. Product CI, backend tests, browser E2E, role/context design gate and mobile design gate pass on the exact PR HEAD. Preview-provider rate limits are not treated as code failures; live legal/payment/signature readiness is assessed separately.

## 8. Implementation status at specification creation

**Confirmed in source:** one shared User identity; academy catalogue and Course rows; user-owned SchoolEnrollment progress; payment settlement creates enrollment after confirmed payment; course lesson/exam endpoints; user-owned job application list and resume visibility; employer Organization, vacancy scoping and constrained application status transitions.

**Confirmed gaps:** no dedicated personal My Learning home; the current Jobs page embeds candidate records inside vacancy discovery and `/jobs/applications` is only a redirect; candidate application API omits employer Organization identity and immutable status history; there are no separate JobInvitation, JobInterview, JobOffer or EmploymentContract records and no formal direct-offer inbox.

This status is a source audit, not a release certification. Exact-head CI and E2E evidence is required after implementation.
