# DECISION & ACTION HANDOUT
## All-Hands Tech Meeting | February 23, 2026

**Prepared for:** Todd Delano, Craig Brown, Kyle Lasseter, Eric Rosenfeld, Mark Smith, John Flynn  
**Date:** Feb 23, 2026 | 2:30–3:30 PM MST  
**Contact:** Christian (Platform Lead)

---

## DECISIONS REQUIRED TODAY (Feb 23)

### DECISION #1: RESOURCE COMMITMENT — 2 ADDITIONAL TECHNICIANS

**What:** Approve budget for 2 low-wage technicians (~$2.5K/month recurring)

**Why:**
- Clarity launch (Mar 7–10) requires post-launch support team
- 9.3 FTE is already lean for 9 active projects + platform maintenance
- 2 technicians absorb HITL queue management, ops support, PrintDeed backlog
- Payback: POP, Hatco, G&C revenue covers cost in 60 days

**Owner:** Craig Brown (Ops) + Mark Smith (Finance)  
**Decision Needed:** APPROVE or DENY  
**If Approved:**
- Hire by: March 1, 2026
- Onboarding lead: Christian + ops manager
- First deployment: HITL queue (Clarity launch support)

**If Denied:**
- Clarity post-launch risk increases
- Dev team splits focus between ops + new projects
- Estimated 4-week delay on next project launches

---

### DECISION #2: CLAUDE AI SECONDARY LAYER — $30K INVESTMENT

**What:** Greenlight $30K one-time investment in Claude AI validation layer for document processing

**Why:**
- **Problem:** Klippa at 60% accuracy; operators spend 30–40% of time correcting errors
- **Solution:** Claude AI validates Klippa extractions; achieves 95% confidence
- **Impact:** Legal, Medical, BPO verticals unblocked; HITL becomes exception-based (not manual-review-based)
- **Timeline:** 4–6 weeks to production
- **ROI:** Reduces HITL time by ~30%; revenue upside on Litify, Fendon Law, and 10+ future legal clients

**Owner:** Mark Smith (Finance) + Eric Rosenfeld (CIO)  
**Decision Needed:** APPROVE or DEFER  
**If Approved:**
- Work begins: Feb 24, 2026
- Go/no-go decision: Mar 20 (if testing shows <90% confidence, pull plug)
- Production deployment: Late March 2026

**If Deferred:**
- We're stuck with 60% Klippa accuracy through Q1
- Legal/Medical verticals blocked until Q2 at earliest
- SER/Klippa scope dispute remains unresolved

---

### DECISION #3: GOVERNANCE — FORMALIZED PROJECT INTAKE PROCESS

**What:** Establish a structured weekly sync for project requests (Kyle + Christian + 1 ops rep)

**Why:**
- Kyle has been assigning projects ad-hoc; Christian needs predictable intake
- 9 projects exist; more will come. Structure prevents surprises and resource conflicts
- Sync format: scope → estimate → DECIDE (yes/no/defer)

**Owner:** Kyle Lasseter + Christian  
**Cadence:** Every Monday, 10:00 AM (30 min)  
**Decision Needed:** COMMIT or DECLINE  
**If Committed:**
- First sync: Monday, Feb 24, 2026
- Format: Agenda shared by Friday
- Output: Weekly project log (shared with Todd/Mark for visibility)

**If Declined:**
- Ad-hoc project assignments continue
- Christian's capacity becomes opaque
- Risk of overcommitment and quality decline

---

### DECISION #4: PROTECTED SSOT DEVELOPMENT TIME

**What:** Reserve 20% of dev team time (0.8 FTE) for platform resilience and technical debt

**Why:**
- Clarity is the foundation for all 4 verticals; if it breaks, everything breaks
- Post-launch, bugs and scaling issues will surface
- 20% allocation prevents client work from raiding platform stability
- This is a structural ask, not a project budget

**Owner:** Craig Brown (Ops) + Eric Rosenfeld (CIO)  
**Decision Needed:** APPROVE or RENEGOTIATE  
**If Approved:**
- Implementation: Starts March 11 (post-Clarity launch)
- Backlog: Quarterly SSOT sprint for critical issues
- Tracking: Monthly report to Eric + Christian

**If Renegotiated to <20%:**
- Specify % allocation and monitoring approach
- Acknowledge increased technical debt risk

**If Declined:**
- Clarity stability becomes unpredictable
- Next project launches depend on Clarity uptime

---

## DECISIONS REQUIRED SOON (Mar 15 & Mar 31)

### DECISION #5: VG MERGER GAPS & LABOR STRUCTURE

**What:** Formalize outstanding VG merger items and PrintDeed team labor classification

**Why:**
- PrintDeed team (3.3 FTE) is operational but contractual status is unclear
- VG transition gaps could create legal or equity disputes
- Board review coming; needs to be clean

**Owner:** John Flynn (Legal)  
**Deadline:** March 15, 2026  
**Scope:**
1. Any outstanding IP transfer or equity items from VG merger
2. PrintDeed team: contractor, employee, or subsidiary status?
3. Documentation: Signed agreements for all labor arrangements
4. Impact on Christian's role: Does he manage PrintDeed directly or through ops?

**Output:** Clean documentation; board-ready status

---

### DECISION #6: ERP / eCOMMERCE STRATEGY

**What:** Decide: Do we build a vertical-specific ERP, or focus on integrations?

**Why:**
- Triangle Design web store is waiting on billing ownership
- Presario, POA, and others hint at B2B platform opportunities
- Decision affects roadmap and resource planning for Q2+
- If yes, who owns it? If no, how do we handle these requests?

**Owner:** Todd Delano (Revenue) + Eric Rosenfeld (CIO) + Kyle Lasseter (Projects)  
**Deadline:** March 31, 2026  
**Decision Options:**
1. **BUILD:** Invest 1–2 FTE in a proprietary ERP/eComm platform (high long-term upside)
2. **INTEGRATE:** Use Shopify/NetSuite/etc. and focus on automation layers (faster, lower risk)
3. **DEFER:** Decide in Q2 after Clarity stabilizes
4. **CASE-BY-CASE:** Evaluate each request; no pre-commitment

**Output:** Clear decision on strategy; roadmap alignment

---

## ACTION ITEMS BY PERSON

### JOHN FLYNN (Legal)
- [ ] **#1 PRIORITY:** Collect all VG merger documentation; identify gaps
- [ ] **#2 PRIORITY:** Clarify PrintDeed team labor classification (contractor/employee/subsidiary)
- [ ] **#3 PRIORITY:** Review SER/Klippa contract; determine scope accountability (Kyle will input)
- [ ] **Deadline:** Mar 15, 2026
- [ ] **Deliverable:** Memo to board; signed agreements for all labor arrangements
- [ ] **Contact:** Christian for clarifications

---

### CRAIG BROWN (Operations)
- [ ] **#1 PRIORITY:** Approve or deny 2 additional technicians ($2.5K/month)
- [ ] **#2 PRIORITY:** (If approved) Hire and onboard by Mar 1
- [ ] **#3 PRIORITY:** Define post-launch Clarity SLA (99.5% uptime, 1-hour incident response)
- [ ] **#4 PRIORITY:** Commit to or renegotiate 20% protected dev time
- [ ] **Deadline:** TODAY (Feb 23) for decisions; Mar 1 for hiring
- [ ] **Contact:** Christian for onboarding details

---

### MARK SMITH (Finance)
- [ ] **#1 PRIORITY:** Approve or deny 2 additional technicians ($2.5K/month recurring)
- [ ] **#2 PRIORITY:** Approve or defer $30K Claude AI investment
- [ ] **#3 PRIORITY:** Set up monthly project revenue tracking (baseline vs. forecast)
- [ ] **#4 PRIORITY:** Schedule 3-month ROI review (May 31) with Christian + Todd
- [ ] **Deadline:** TODAY (Feb 23) for decisions
- [ ] **Deliverable:** Budget approval; monthly tracking dashboard
- [ ] **Contact:** Christian for project-level financials

---

### TODD DELANO (Principal Partner)
- [ ] **#1 PRIORITY:** Understand revenue roadmap and ROI on new technicians / Claude investment
- [ ] **#2 PRIORITY:** Buy into 2-year platform strategy (build to own, not license)
- [ ] **#3 PRIORITY:** Co-own ERP/eComm decision with Eric (by Mar 31)
- [ ] **#4 PRIORITY:** Schedule 3-month ROI review (May 31) with Mark + Christian
- [ ] **Deadline:** TODAY (Feb 23) for strategy buy-in; Mar 31 for ERP decision
- [ ] **Contact:** Christian for quarterly updates

---

### KYLE LASSETER (Project Partner)
- [ ] **#1 PRIORITY:** Commit to weekly Monday sync (10 AM) for project intake
- [ ] **#2 PRIORITY:** Work with Christian on SER/Klippa scope accountability
- [ ] **#3 PRIORITY:** Co-own ERP/eComm decision with Todd + Eric (by Mar 31)
- [ ] **#4 PRIORITY:** Prepare project backlog for first intake sync (Feb 24)
- [ ] **Deadline:** TODAY (Feb 23) to commit to sync; Feb 24 for first meeting
- [ ] **Deliverable:** Weekly project log; clear scope on SER/Klippa expectations
- [ ] **Contact:** Christian (sync owner)

---

### ERIC ROSENFELD (CIO)
- [ ] **#1 PRIORITY:** Approve or defer $30K Claude AI investment
- [ ] **#2 PRIORITY:** Commit to or renegotiate 20% protected SSOT dev time
- [ ] **#3 PRIORITY:** Co-own ERP/eComm decision with Todd + Kyle (by Mar 31)
- [ ] **#4 PRIORITY:** Allocate compute budget for model training (annotation infrastructure)
- [ ] **#5 PRIORITY:** Schedule quarterly sync with Christian on platform strategy
- [ ] **Deadline:** TODAY (Feb 23) for Claude/SSOT decisions; Mar 31 for ERP
- [ ] **Contact:** Christian for technical details

---

### CHRISTIAN (Platform Lead)
- [ ] **#1 PRIORITY:** Distribute this handout (Feb 23, end of meeting)
- [ ] **#2 PRIORITY:** Schedule first weekly project sync (Monday, Feb 24, 10 AM)
- [ ] **#3 PRIORITY:** If decisions are APPROVED: Onboarding plan for 2 technicians (due Mar 1)
- [ ] **#4 PRIORITY:** If Claude is APPROVED: Start development immediately (go/no-go: Mar 20)
- [ ] **#5 PRIORITY:** Monthly tracking: Revenue vs. forecast, resource utilization, incident count
- [ ] **Deadline:** Ongoing (weekly sync owner)
- [ ] **Contact:** Christian for all project-level questions

---

## OUTCOMES: IF ALL DECISIONS ARE APPROVED

### By March 15
- VG gaps formalized; labor structure clear
- 2 technicians hired; onboarding in progress
- Clarity beta launches (Feb 28)
- Claude AI development underway

### By March 31
- Clarity in production (Mar 7–10)
- Claude AI testing (go/no-go decision)
- ERP/eComm strategy decided
- 2 technicians operational; HITL queue running
- Weekly project sync established (4 meetings completed)

### By May 31 (Q2 End)
- 5 projects in production: Hatco, G&C, City of LA, POP, Litify/Fendon Law
- Team at 11.3 FTE, sustainable load
- Annotation infrastructure foundation laid
- **Q2 ARR Run-rate: $78–108K**
- 3-month ROI review completed; board-ready

---

## OUTCOMES: IF KEY DECISIONS ARE DEFERRED OR DENIED

| Decision | If Deferred | If Denied |
|----------|------------|----------|
| **2 Technicians** | Ops bottleneck persists | Post-launch support team incomplete |
| **Claude AI** | Klippa accuracy stays at 60% | Legal/Medical verticals blocked indefinitely |
| **Weekly Sync** | Ad-hoc projects continue | Resource conflicts and surprises persist |
| **Protected SSOT Time** | Technical debt accumulates | Platform stability unpredictable |
| **VG Formalization** | Legal risk lingers | Board review delayed; org uncertainty |
| **ERP Strategy** | Presario/Triangle stall | Roadmap chaos; resource conflicts |

---

## ESCALATION PATH

**If decisions stall or conflict arises:**
1. **Week of Feb 24:** Christian surfaces blockers in standup
2. **Week of Mar 3:** Todd/Craig/Eric resolve conflicts; decision made by Mar 5
3. **Week of Mar 10:** Confirm approved decisions in writing; implementation begins

**Contact:** Christian (primary) or Todd (escalation)

---

## NEXT MEETINGS

| Meeting | When | Who | What |
|---------|------|-----|------|
| **Weekly Project Sync** | Every Monday 10 AM | Kyle + Christian + Ops | Project intake, resource planning |
| **Monthly Revenue Review** | 1st Friday of month | Mark + Todd + Christian | Actual vs. forecast, ROI |
| **Quarterly Strategy Sync** | End of quarter | Eric + Christian + Todd | Platform roadmap, long-term vision |
| **3-Month ROI Review** | May 31 | Todd + Mark + Christian | Did we hit targets? Adjust? |

---

## QUESTIONS?

**Christian** → All project-level and technical questions  
**Mark** → Budget and financial tracking  
**John** → Legal and contractual questions  
**Todd** → Revenue and strategic questions  
**Eric** → Platform and technical strategy questions  
**Kyle** → Project intake and scoping questions  
**Craig** → Operations and resource questions

---

**Print this. Carry it. Reference it. Decisions are binding when signed/confirmed via email.**

---

**Document prepared:** Feb 23, 2026 at All-Hands Meeting  
**Approved by:** [Signatures / Email confirmations to follow]  
**Tracking:** Christian to maintain decision log and action status
