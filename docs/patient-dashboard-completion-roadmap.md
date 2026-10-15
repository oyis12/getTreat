# Patient Dashboard Completion Roadmap

**Status:** Audit baseline and sequenced completion plan  
**Audit scope:** Backend in this repository, `getTreat-api.json`, handoff/agent guidance, and all exported references under `designs/patients_dashboard/` (10 folders).  
**Last reviewed:** 2026-10-15

This is the working checklist for completing the patient dashboard before beginning the provider, admin, and super-admin design audits. It records the gaps found during the patient-design audit and the evidence-based limits on infant consent, postpartum care, and clinical assessment results. Update the checkboxes and “Current state” notes as each item is implemented and tested.

## 1. Audit conclusion

The patient dashboard is **partially implemented**, not complete. Core patient identity, pregnancy history/progress, health-condition records, assessment answer persistence, vitals, baby records/growth history, provider-service discovery/subscriptions, appointments, payment history, and provider instructions exist. Several complete screen groups have no corresponding API domain yet, and some existing APIs have lifecycle/coverage gaps.

The screens represent user workflows, not a one-screen/one-model requirement. New domain work must preserve the existing `User` identity plus actor-profile model and the separate platform/provider subscription domains.

## 2. Design-by-design findings

The folders below were visually reviewed as a set (286 exported PNG screens in total). Use the named folder as the design reference when each roadmap item is implemented; do not infer a data model only from a PNG title.

| Design folder | Current backend coverage | Gaps to close |
| --- | --- | --- |
| `dashboard/` | Patient profile/pregnancy, vitals, health assessments, provider instructions, provider service subscriptions and appointments can be fetched through separate APIs. | No patient dashboard aggregate endpoint; no API-backed dashboard summary cards/weekly archive, article/content feed, or meal/food recommendations shown in the exports. Define which cards can safely aggregate existing sources before adding a composite endpoint. No medical/diet recommendations without approved content and clinical review. |
| `Health management/` | Health-condition catalogue, patient-reported conditions, configurable question definitions and saved answers exist. Assessment result deliberately remains `pending` with no score. | No complete clinical-result workflow or clinician review/closure loop. The current question sets are not validated scoring instruments. The postpartum recovery/health-check screen has no corresponding postpartum assessment workflow. Map its exact inputs and safe patient-facing outcome; never label a symptom checklist as a diagnosis. |
| `My profile/` | Patient account/profile read/update and avatar upload exist; appointments and provider interaction APIs are separate. | Profile screens include partner/share-related actions, a calendar/reminder view, and patient-created post/activity surfaces that lack matching patient APIs. Confirm the exact ownership, visibility, invite/consent, reminder recurrence/time-zone, and deletion behavior before modelling. |
| `my vitals/` | Blood-pressure and blood-sugar records support create/list/detail/update/delete and summary/report operations. | No clinical interpretation should be added from the current designs alone. Confirm units, date ranges, empty/error states and reports against the exports; keep raw measurements distinct from diagnoses or emergency triage until a clinician-approved rule exists. |
| `New born care_my baby/` | Baby records are embedded under a pregnancy; photos, measurements, growth-history records and progress/report endpoints exist. The current lifecycle slice now captures versioned guardian attestation, records birth/delivery mode, and resolves owned babies across pregnancy history. | Jurisdiction-specific guardian verification/legal review is still required. The Day/Week postpartum content and archive screen has no content API; its export includes placeholder copy and pregnancy-oriented text in a postpartum view, so approved postnatal content and timeline ownership are needed before seeding it. Milestone tracking/history and feeding timers/plans/logs are not fully represented. Growth percentiles/WHO comparisons are placeholders and must not be presented as implemented. Historical baby/health access after platform-subscription expiry is unresolved. |
| `Patients inbox and notification/` | No dedicated patient messaging/inbox domain found; provider instructions are append-only clinical instructions and are not a chat system. | No conversation/thread, read state, message delivery, attachment, call/session, or notification API matching these screens. Define who can message whom and when, retention/reporting, and any clinical emergency copy before adding it. |
| `Providers/` | Provider service catalogue/discovery, provider subscriptions, appointments, and instruction history are implemented. | The exports also show provider directory/detail/profile content, reviews/ratings, follow/community interactions, posts/comments/reports, and video/audio/message contact surfaces not represented as a full set of APIs. Appointment mode selection is not a telehealth session. Preserve provider approval and patient/provider relationship checks. |
| `Support/` | No support-ticket domain/API found. | Ticket create/list/detail/reply/status/attachment and staff assignment/resolution flows are absent. Confirm support actors, privacy boundaries, SLA/status values and whether patient/provider can see the same ticket before implementation. |
| `Transactions/` | Patient transaction history can include provider-service, appointment, and platform-subscription payment attempts. | Screen-level transaction summaries, receipt/download detail and full fee/payment lifecycle presentation need comparison and API serialization review. Do not add a stored card/wallet model; Paystack hosted checkout remains the payment boundary. |
| `Community/` | No community/group/post domain/API found. | Group discovery/filtering, public/private access, membership, posts/media, comments, reports/shares, events and paid-ticket workflows are outstanding. This is a later community phase after the core patient dashboard. |

**Ads:** explicitly out of scope; no ads should be added.

## 3. Code and contract findings to carry forward

1. **Pregnancy-scoped baby access (fixed in this slice):** the initial audit found `services/baby.service.js` and `services/baby-progress.service.js` limited lookups to `is_current=true`. Baby CRUD, photo and progress/growth lookups now resolve only babies in the authenticated patient's embedded pregnancy history; adding a baby to a completed pregnancy requires that patient's own pregnancy ID and a birth confirmation.
2. **Infant consent (attestation implemented; verification unresolved):** the initial audit found no guardian-consent audit data. New baby creation now requires the design checkbox and stores consent version, timestamp, authenticated user, and scope. Legacy records are not auto-consented. This does not verify identity/guardian authority or establish universal legal compliance; deployment-specific verification/legal requirements remain open.
3. **Clinical result behavior:** `services/health-assessment.service.js` calls `clearUnscoredAssessmentResult()` on every save, setting `result_status="pending"` and `score=null`. This is intentional and safer than inventing weights/cutoffs for the current custom questions. The patient cannot set a result or diagnosis.
4. **Gestational-diabetes screen discrepancy:** a Health Management export contains a question worded “How do you see things?” that does not appear in `scripts/seed-health-conditions.js`. Its intended meaning/answer type is unclear, so it is not added to the backend questionnaire until the clinical/product owner confirms it.
5. **Milestone status:** `getTreat-api.json` states developmental milestone/percentile content is placeholder pending approved reference data. CDC distinguishes parent milestone monitoring from formal screening/evaluation; checklist answers must not be rendered as a developmental diagnosis.
6. **API reference:** `getTreat-api.json` was on version `2026-10-15-4O` at audit start. It now documents the birth-confirmation route, consent requirement, pregnancy-history baby access, and updated pregnancy/baby response fields.
7. **Handoff conflict (fixed in this slice):** the current continuation now says finish the patient-dashboard audit after 4O and before actor audits; stale statements that 4N was current and 4O upcoming have been corrected.
8. **Current checkout:** pre-existing user change `docs/platform-subscriptions-4o-api.md` was present before this roadmap work and must be preserved.

## 4. Evidence-based decisions and safety boundaries

### Infant data consent

There is no single “worldwide” infant-consent form or age/identity verification mechanism. Requirements depend on the countries where GetTreat operates and on the legal basis for processing. Nigeria's Data Protection Act, 2023, for example, says that where a controller relies on consent for a child or person lacking legal capacity, it obtains parent/legal-guardian consent and applies an appropriate mechanism to verify age and consent; it also has exceptions, including some medical-care processing under a duty of confidentiality. This is a legal-design input, not a conclusion that a checkbox makes GetTreat compliant.

**Safe product baseline to take to implementation:** capture an explicit guardian attestation before creating a baby's record; persist the consent text/version, timestamp, authenticated accepting user and scope; make consent status auditable and revisable; do not collect more identity documents than the approved local workflow needs. Keep a deployment-level legal/privacy review TODO for target jurisdictions and a real consent-verification mechanism. Never describe the baseline as globally legally sufficient.

### Postpartum access and lifecycle

WHO recommends postnatal care for the woman and newborn, including care in the first 24 hours and additional contacts around 48–72 hours, 7–14 days and week six; individual risks may require more care. The safe backend implication is that pregnancy completion must not erase the patient's access to the pregnancy history or its baby records. A birth/end action should preserve the ended pregnancy and allow its babies to remain readable/updatable according to the approved patient ownership rules. A digital checklist cannot replace postnatal care or urgent assessment.

### Clinical screening and assessment results

There is no universal scoring rule that can safely be applied to these current custom question lists. ACOG recommends standardized, validated instruments for perinatal depression/anxiety screening with systems for timely assessment, diagnosis, treatment and follow-up; affirmative self-harm responses call for immediate clinician assessment, and postpartum psychosis requires immediate medical attention. The current repository questionnaire definitions are not EPDS/PHQ-9/GAD-7 or another identified, validated instrument, so applying a threshold now would be unsafe and unsupported.

**Current result rule remains:** save answers; return `pending` (no score, no risk class, no diagnosis) until an approved validated tool, scoring specification, locale/translation, licensed content decision and clinician follow-up pathway are configured. Developmental milestone checklist answers are monitoring prompts; a missed milestone/parent concern should prompt discussion with a child's healthcare professional, not an automated diagnosis. WHO growth comparisons require correct age/sex/measurement and the actual official reference data and must be presented as growth monitoring, not a diagnosis.

## 5. Ordered completion plan

### Step 0 — Keep the audit baseline (this document)

- [x] Record the design/code findings, research and sequence here.
- [x] Fix conflicting 4O/4N statements in the complete handoff and link this roadmap from it.
- [x] Update this checklist after this phase and keep `getTreat-api.json` aligned with mounted routes.

### Step 1 — Close current patient lifecycle and privacy gaps

- [x] Inspect exact My Baby birth/guardian-consent exports and map the supported delivery modes.
- [x] Add versioned guardian attestation capture (no silent consent for legacy records); no legacy data was backfilled.
- [x] Add an explicit birth-confirmation workflow that preserves the embedded pregnancy in history and derives ownership from the signed-in patient.
- [x] Fix baby CRUD/photo/growth/progress lookup to include completed pregnancies and scope baby IDs to the authenticated patient's own embedded history.
- [x] Document mounted route/request changes in `docs/patient-infant-postpartum-api.md` and update `getTreat-api.json`.
- [x] Add mocked service-level tests for birth state mutation, accepted consent persistence, and completed-pregnancy baby CRUD.
- [ ] Decide the actual consent/guardian verification mechanism for each deployment jurisdiction and whether platform-subscription expiry permits read-only access to historical infant/health data.

### Step 2 — Health management and postpartum

- [ ] Map every postpartum/recovery/self-assessment input and screen action to a non-diagnostic record and a safe patient-facing result.
- [ ] Treat the My Baby Day/Week postpartum archive as an educational-content feed, separate from the postpartum recovery assessment; obtain approved postnatal copy and a day/week timeline before implementing its content endpoint.
- [ ] Keep clinical status `pending` until a real, validated instrument and approved clinician workflow are selected; do not score current ad-hoc questions.
- [ ] Add an explicit emergency/help pathway only where the screen and clinical owner provide approved copy and local contact routing.
- [ ] Define how providers can review/record results and how patient access/consent authorizes the relationship.
- [ ] Test incomplete/complete answers, result immutability from clients, history, ownership and provider authorization.

### Step 3 — Baby milestone/growth/feeding screens

- [ ] Implement milestone monitoring and history with dated answers and caregiver notes supported by the exports; never label it screening/diagnosis.
- [ ] Add the “talk with the child's clinician” referral state if supported by approved copy/flow.
- [ ] Decide official WHO growth-reference version/data, unit normalization, age-at-measurement calculation and display wording with a clinical owner before percentiles/z-scores.
- [ ] Map feeding timers/plans/logs exactly from exports; do not generate nutrition or feeding advice without approved content.
- [ ] Test date boundaries, history order, measurement units, correction/deletion and privacy access.

### Step 4 — Finish existing patient-facing API gaps

- [ ] Compare dashboard and vitals screens against existing output fields, empty states, filters, report ranges and summaries; add only missing aggregation/serialization.
- [ ] Decide and implement approved articles/meal content source or remove unsupported recommendation expectations; no ad surfaces.
- [ ] Complete provider directory/detail/review/follow and patient-provider interaction surfaces with explicit moderation, ownership and relationship rules.
- [ ] Align transaction list/detail/receipt outputs with screens while preserving Paystack hosted payment and the no-card-storage decision.
- [ ] Add calendar/reminders, partner sharing, and patient post/activity APIs only after the specific audience, consent, visibility, recurrence and deletion rules are documented.
- [ ] Add inbox/messages/calls only after roles, relationship gates, urgency disclaimer, report/block, retention and attachment rules are established.

### Step 5 — Community and support domains

- [ ] Implement Support tickets and staff workflow from `Support/` exports.
- [ ] Implement Community discovery, group access, membership, posts/media/comments/report/share, events and paid entry as separately specified workflows.
- [ ] Add moderation, audit, privacy, soft-delete and payment tests; keep these separate from provider instruction history.

### Step 6 — Final patient acceptance audit

- [ ] Walk all 286 exports again against the implemented endpoints and `getTreat-api.json`.
- [ ] Verify every action, input, output, loading/empty/error state, role check, ownership boundary and side effect has a documented backend disposition.
- [ ] Run the full test suite plus focused API tests; report local tests separately from live MongoDB/Paystack evidence.
- [ ] Update this roadmap, the complete handoff, and API reference with completed/deferred items and then begin provider UI audit.

## 6. Sources consulted

- Nigeria Data Protection Act, 2023, §31 (child/personal-capacity consent and verification): [NDPC-hosted Act PDF](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf).
- WHO, *Recommendations on maternal and newborn care for a positive postnatal experience* (2022): [WHO guideline](https://www.who.int/publications/i/item/9789240045989) and [WHO summary of postnatal contacts](https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth).
- ACOG, *Screening and Diagnosis of Mental Health Conditions During Pregnancy and Postpartum*, Clinical Practice Guideline 4 (2023): [Guideline](https://www.acog.org/clinical/clinical-guidance/clinical-practice-guideline/articles/2023/06/screening-and-diagnosis-of-mental-health-conditions-during-pregnancy-and-postpartum) and [patient-screening summary](https://www.acog.org/programs/perinatal-mental-health/patient-screening).
- CDC, [Developmental Monitoring and Screening](https://www.cdc.gov/act-early/about/developmental-monitoring-and-screening.html) and [milestone-checklist use](https://www.cdc.gov/wic-guide/php/administer-milestone-checklists/four-simple-steps.html).
- WHO, [Child Growth Standards](https://www.who.int/childgrowth/standards/en/).

The cited clinical sources support safe workflow boundaries, not a substitute for GetTreat's clinical governance or jurisdiction-specific legal advice. ACOG/CDC material is authoritative guidance in its context; it does not establish a single global legal or clinical rule.
