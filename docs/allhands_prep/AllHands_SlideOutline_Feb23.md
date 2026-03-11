# All-Hands Tech Meeting: Slide Deck Outline
**Date:** February 23, 2026 | **Time:** 2:30–3:30 PM MST  
**Audience:** 6 Partners/Executives | **Duration:** 60 minutes

---

## Slide 1: Title / Opening
**Key Message:** This is not a status update—it's a strategic alignment on platform vision, resource commitments, and governance that unlocks our next growth phase.

**Content:**
- Title: "Building Our Platform: Strategy, Risk, and Decisions"
- Subtitle: "Where we are. What we've learned. What we need from this room."
- Visual: Clean, modern design; Christian's name and date
- No bullet points

**Visual Cue:** Minimal title slide. Consider a subtle visual motif—maybe a layered platform icon or converging paths—to signal "building something integrated."

**Speaker Note:** "Thanks everyone for making time today. Over the last six months, we've learned a lot about what happens when you try to scale document intelligence across four verticals with a single third-party vendor. Today I want to walk you through our portfolio, surface a critical technical reality about Klippa, and ask for some specific decisions that let us move faster and smarter. This isn't about panic—it's about positioning ourselves to own the solution instead of depending on someone else's roadmap."

**Time:** 2 minutes

---

## Slide 2: The Portfolio at a Glance
**Key Message:** We have 9 active projects across 4 verticals—all sharing one infrastructure foundation—representing over $105K in active work and proving repeatability at scale.

**Content:**
- **BPO** (2 projects): City of LA, POP System ($105K)
- **Manufacturing** (2 projects): Hatco, G&C (proving concept)
- **Legal** (2 projects): Litify, Fendon (workflow)
- **Medical** (1 project): ERP/eCommerce, Presario, POA/Whitewolf (3 biz dev opportunities)
- **Total:** 9 projects, 9.3 FTE team, ~$11.2K/month burn

**Visual Cue:** A four-quadrant grid or circular diagram showing verticals with project names, revenue/status, and shared infra layer at the center (Clarity Platform). Use color coding by vertical.

**Speaker Note:** "We're not running a services business—we're building a platform that services businesses. These nine projects aren't isolated: they all sit on top of Clarity, our custom platform launching in six days. That shared foundation is what makes this repeatable. Each project teaches us something; each success de-risks the next one."

**Time:** 3 minutes

---

## Slide 3: Clarity Platform — The Foundation
**Key Message:** Clarity launches Feb 28 (beta) and Mar 7–10 (go-live)—a multi-tenant, cloud-native platform that is the technical and business foundation for all four verticals.

**Content:**
- **Status:** 90% complete; beta Feb 28; go-live Mar 7–10
- **Tech Stack:** .NET 8 (backend), Next.js (frontend), PostgreSQL (data), Redis (cache), AWS ECS Fargate (infra)
- **Capabilities:** Multi-tenant isolation, document ingestion, extraction workflow, role-based access, vendor-agnostic extensibility
- **Why it matters:** Removes the "one-off services for each client" trap; creates a repeatable, scalable business unit

**Visual Cue:** A horizontal technology stack diagram showing .NET → Next.js → PostgreSQL/Redis → Fargate. Include a timeline bar: "Feb 28 (beta) → Mar 7–10 (live)."

**Speaker Note:** "Clarity is the skeleton key. Everything we do after March 10 will be faster, cheaper, and more reliable because we're not rebuilding the wheel for each client. This is the moment we move from 'custom development' to 'platform plus configuration.' That shift is worth the investment."

**Time:** 4 minutes

---

## Slide 4: The Four Verticals
**Key Message:** Each vertical has unique workflows, regulatory requirements, and market size—all addressable by one platform plus vertical-specific modules.

**Content:**
- **BPO** (Back-Office Process Outsourcing): Largest TAM, highest margin, proven with City of LA
- **Manufacturing** (Hatco, G&C): Supply chain / order capture; proving extraction accuracy matters
- **Legal** (Litify, Fendon): Contract workflow, compliance, audit trail; Litify integration = proof point
- **Medical:** ERP/eCommerce integration play; highest regulatory lift, highest switching cost

**Visual Cue:** Four vertical bars or sections, each with 2–3 bullet points (workflow, regulatory, GTM). Show Clarity as the shared base layer beneath all four.

**Speaker Note:** "These aren't random projects. Each one represents a market segment where document intelligence is table stakes. What they have in common: vendors who control their own extraction, vendors who slow down, vendors who raise prices. What they need: speed, accuracy, and the ability to iterate on workflows without waiting for a third party."

**Time:** 3 minutes

---

## Slide 5: The Klippa Reality — Technical Issues (Critical Slide)
**Key Message:** Klippa has structural limitations that prevent us from scaling to 95% accuracy and on-demand turnaround—and they have no accountability when it fails.

**Content:**
- **Multiple templates per vendor:** Unsustainable at scale; Klippa forces one template per vendor, but real vendors have format variants
- **Page-length timeouts:** 30+ page documents timeout; limits use cases in manufacturing & legal
- **Table extraction failures:** Inconsistent vendor formats break Klippa's table parser; 15–20% failure rate on complex tables
- **OCR accuracy floor:** Current Klippa = ~60% confidence; gaps in handwriting, poor scans, non-English text
- **EU data routing:** Requests routed to EU servers; latency + GDPR compliance overhead
- **SER/Klippa accountability gap:** Contract is silent on SLA/remediation; when extraction fails, Klippa points to "poor image quality"

**Visual Cue:** A slide with 6 red boxes or callouts, one per issue. Consider a visual showing "Confidence Gap" comparing 60% (Klippa) to 95% (Claude-based solution).

**Speaker Note:** "I want to be direct: Klippa works for simple cases. But we're not building for simple cases. We're building for manufacturers with 50-page specs, law firms with tables and amendments, processes where 60% accuracy means rework. And here's the accountability problem: we're contractually dependent on a vendor who has no obligation to fix these things. They've already told us, 'That's your problem to solve.' We can't build a business on that."

**Time:** 5 minutes

---

## Slide 6: The 60% vs 95% Decision
**Key Message:** Our testing shows Claude-based extraction achieves 95% confidence on the same documents that Klippa fails on—the business case for building our own layer is proven.

**Content:**
- **Klippa baseline:** 60% confidence; requires significant human review
- **Claude AI testing:** 95% confidence; reduces review burden by 70–80%
- **Cost per extraction:** Klippa: ~$0.15 per doc + review labor; Claude-based: ~$0.08 per doc + minimal review
- **Time to iterate:** Klippa: 4–6 weeks (request, hope, wait); Claude-based: 24 hours (our code, our tuning)
- **Business impact:** 3–5x faster client turnaround, 40% lower cost per extraction, zero vendor dependency

**Visual Cue:** A side-by-side bar chart or table comparing Klippa vs. Claude-based solution across accuracy, cost, speed, and control. Make the 95% number visually dominant.

**Speaker Note:** "This is the moment we decide: Do we accept Klippa's ceiling, or do we invest in our own solution? The data is clear. Claude-based extraction outperforms Klippa on every metric that matters to us. It's more accurate, it's cheaper, it's ours to tune. The question is not whether we can do it—we've already proven we can. The question is how fast we want to do it."

**Time:** 4 minutes

---

## Slide 7: The Bridge Strategy
**Key Message:** We use Klippa now (proven, operational) and build our own extraction layer in parallel—the annotation partnership accelerates both.

**Content:**
- **Phase 1 (Now–Apr 30):** Klippa for production; build extraction module alongside
- **Phase 2 (May–Jun):** Annotation partnership: clients provide labeled documents, we train Claude-based models in parallel
- **Phase 3 (Jul+):** Switch production to Claude-based; Klippa becomes fallback/backup
- **Key insight:** The annotation work (required anyway) becomes training data for our models—we learn on their dime
- **Risk mitigation:** Zero production downtime; proven fallback; customer perception = "we're improving accuracy"

**Visual Cue:** A three-phase timeline showing Klippa (fading) and custom extraction (ramping up) crossing over in Phase 2. Show annotation data flowing into both.

**Speaker Note:** "We're not replacing Klippa overnight. We're running both in parallel, and we're being smart about it. Every customer document they send us to annotate becomes training data for our models. By summer, we'll have thousands of real-world examples. By Q3, we'll be ready to switch. This is not a rip-and-replace; it's a measured transition."

**Time:** 3 minutes

---

## Slide 8: Platform Strategy & Eric's Vision
**Key Message:** Clarity is the extensible foundation; extraction is the first module; the long-term vision is a full document-intelligence platform that powers all four verticals.

**Content:**
- **Clarity as SSOT (Single Source of Truth):** One data model, one audit trail, one permission system
- **Extraction module:** First; built-in, replaceable, tunable
- **Future modules:** Validation, workflow automation, compliance rules engine, client-specific customizations
- **Eric's platform vision:** Every customer sees the same UI, same data model, custom workflows—true SaaS repeatability
- **Vendor strategy:** Claude for extraction, AWS/Postgres for infra, our code for value

**Visual Cue:** A layered architecture diagram with Clarity at the base, extraction module second, future modules (validation, workflow, rules) above. Show client customization as a thin layer.

**Speaker Note:** "Eric and I have talked about this a lot. Clarity is not a one-off project—it's the starting point for a real platform business. Today we're focused on extraction because that's the bottleneck. But the real win is this: over the next 12 months, we build a stack that every vertical can use, every client can configure, and we can scale predictably. That's the company we're building."

**Time:** 3 minutes

---

## Slide 9: Active Project Portfolio
**Key Message:** We have 9 active projects generating learning, revenue, and proof points—each one is either a revenue driver, a technical proof point, or a strategic opportunity.

**Content:**

| Project | Vertical | Status | Value | Priority |
|---------|----------|--------|-------|----------|
| City of LA | BPO | Active | $50K+ | Revenue |
| POP System | BPO | Active | $105K | Revenue |
| Hatco | Manufacturing | Beta | Proof point | Accuracy test |
| G&C | Manufacturing | Building | Proof point | Workflow test |
| Litify | Legal | Integration | Strategic | Partner validation |
| Fendon | Legal | Planning | Strategic | Market expansion |
| Presario | Medical | Planning | Biz dev | Vertical expansion |
| POA/Whitewolf | Medical | Early | Biz dev | Regulatory proof |
| ERP/eCommerce | Biz dev | Planning | $50K+ potential | Strategic decision |

**Visual Cue:** A table or kanban-style board showing projects grouped by status (Active Revenue, Beta/Proof, Planning, Early). Use color coding by vertical.

**Speaker Note:** "Here's what we're actually working on. Two projects are generating real revenue right now—City of LA and POP System. Four are proving the technical model: extraction accuracy, workflow automation, compliance. Three are biz dev—they represent expansion vectors that could each become $50K+ annual opportunities. This is not busy work; this is strategic portfolio management."

**Time:** 3 minutes

---

## Slide 10: Resource Picture — Team & Cost
**Key Message:** We're running lean (9.3 FTE, $11.2K/month)—but we're at capacity. Growth requires two additional technicians and clearer governance on how work reaches us.

**Content:**
- **Team composition:** 9.3 FTE via PrintDeed contractor model
- **Monthly burn:** ~$11,200 (all-in, including overhead)
- **Current capacity:** 4–5 active project tracks simultaneously; limited bandwidth for new biz dev
- **Bottleneck:** Context-switching between urgent client work and platform/infrastructure investment
- **Ask #1:** +2 low-wage technicians (document QA, client support, data ops) to free up dev time
- **Ask #2:** Dedicated SSOT (Clarity infrastructure) dev time—currently borrowed from client projects

**Visual Cue:** A bar chart showing current team allocation (% time on client projects vs. platform/infrastructure). Show the gap between "needed" and "current" for infrastructure work.

**Speaker Note:** "We're efficient, but we're squeezed. Every hour I spend on a client-specific problem is an hour I'm not spending on the platform. Every client call about data quality eats into dev time. We don't need a big team—we need the right roles. Two more technicians—call center / QA folks—would free up our developers to focus on Clarity and extraction. That's the ROI play."

**Time:** 3 minutes

---

## Slide 11: What We Need to Decide Today
**Key Message:** We have four specific asks—one per domain—that unblock execution. These are not nice-to-haves; they determine how fast we scale.

**Content:**

**For John (Legal):** VG Merger formalization
- Clarify legal structure of Verse Graphics integration
- Formalize governance (voting, liability, IP ownership)
- Timeline: 30 days

**For Everyone (Governance):** How Project Asks Reach Christian
- Create a formal intake process (who can ask for resources, how requests are prioritized, what data you need)
- Prevents context-switching chaos; makes roadmap visible
- Suggestion: Monthly prioritization call, written requests, clear "Approved/Backlog/Defer" decision

**For Mark & Craig (Resources):** +2 Low-Wage Technicians
- Data QA, document validation, customer support
- Frees dev time for platform investment
- Budget: ~$3K–4K/month
- Hiring timeline: 2 weeks

**For Everyone (Strategy):** ERP/eCommerce Decision
- Do we pursue the medical/retail vertical (Presario, POA/Whitewolf)?
- Requires dedicated client success & compliance expertise
- Go/No-Go decision: Today

**Visual Cue:** Four quadrants or sections, one per ask. Use icons or color coding (Legal, Governance, Resources, Strategy) to make the asks visually distinct.

**Speaker Note:** "I'm going to be very specific here. One: John, I need you to formalize the VG structure so we know who owns what and how we make decisions. Two: All of you, I need a clear governance model for how projects get prioritized. Right now, everyone pulls in different directions. Three: Mark and Craig, I need two more technicians—this is a force multiplier for dev time and costs $3–4K a month. And four: Everyone, we need to decide on the medical/retail play. It's big, but it requires a different kind of expertise. Do we go? Do we partner? Do we defer? Let's decide today."

**Time:** 5 minutes

---

## Slide 12: Christian's Commitment & Expanded Role
**Key Message:** If we get these decisions and resources, Christian is positioned to drive platform development, vertical expansion, and revenue growth—and he's ready for that scope.

**Content:**
- **Current scope:** Technical leadership on extraction, Clarity, project delivery
- **Proposed expansion:** Platform roadmap ownership, vendor relationships (Claude, AWS), vertical market strategy
- **What success looks like:** Clarity v1 live (Mar 10), extraction module in beta (Apr 30), three verticals generating revenue (Jun 30)
- **Accountability:** Monthly updates to Todd & Mark on financials, technical milestones, resource utilization
- **Timeline:** Confirm role expansion today; formalize by Mar 1

**Visual Cue:** A simple venn diagram or growth trajectory showing current responsibilities expanding to include platform roadmap, market strategy, and vendor partnerships.

**Speaker Note:** "Here's what I'm asking for: Trust me with the platform strategy. If we make the governance decisions and allocate the resources, I will deliver Clarity, scale extraction, and grow this into a real business unit. I know what I don't know—compliance, sales, ops—and I'll lean on each of you. But I want to own the technical roadmap and the vendor relationships. That's where I can add the most value. Let's do this."

**Time:** 3 minutes

---

## Slide 13: Open Discussion / Q&A
**Key Message:** This is your chance to ask hard questions, surface concerns, and commit to next steps.

**Content:**
- What questions do you have?
- What concerns are not being addressed?
- What do you need from us to move forward?
- Can we commit to next steps today?

**Visual Cue:** Simple slide with large text; maybe a "Questions?" icon or image of an open door.

**Speaker Note:** "I know I've thrown a lot at you. This is your time. Ask the hard questions—about risk, about cost, about whether this is the right bet. I'm not here to sell you; I'm here to make sure you have what you need to decide."

**Time:** 5 minutes

---

## Slide 14 (OPTIONAL): Appendix — Deep-Dive Slides

If the Q&A raises specific questions, use these backup slides:

### A1: Klippa Contract & Accountability
**Content:**
- Current contract terms (limits, SLA, remediation)
- What Klippa has agreed to, what they've refused
- Legal implications of current structure
- Recommendation: Renegotiate or exit

### A2: Claude AI Testing Results
**Content:**
- Test methodology (document samples, confidence scoring)
- Detailed accuracy comparison (Klippa vs. Claude-based)
- Cost per extraction (breakdown)
- Timeline to production

### A3: Annotation Partnership Framework
**Content:**
- How annotation partnerships work (process, ROI)
- Current partner interest (who's willing, what they want)
- Data governance (who owns the labeled data, how it's used)
- Timeline to 1K+ labeled documents

### A4: ERP/eCommerce Vertical Detail
**Content:**
- Market size & GTM (who, how, timeline)
- Compliance requirements (HIPAA, SOX, etc.)
- Competitive landscape
- Required resources & investment

### A5: Financial Model — 12-Month Outlook
**Content:**
- Revenue projections (4 verticals, current + new projects)
- Expense forecast (team, infra, vendors)
- Gross margin trajectory
- Break-even timeline

---

## SPEAKER NOTES: Opening & Closing Strategy

**Opening (Christian, 2 min):**
"Thanks for making time on a Sunday afternoon. I know everyone's busy. Here's why I asked for this block: We've learned some critical things about building at scale with a third-party vendor, and we've proven some bolder ideas about how to build our own platform. Today is not a status update—it's a chance to align on strategy and make some decisions that determine how fast we scale. I'm going to walk you through the portfolio, surface a real problem we've hit with Klippa, show you our solution, and ask for four specific things from this room. By 3:30, we should have clarity on all of it."

**Closing (Christian, 2–3 min):**
"Here's what I'm walking out with: [Summarize decisions made + commitments received]. We move fast from here. Clarity goes live Mar 10, extraction is in beta by end of April, and by June, we'll have proven this across three verticals. John will finalize the VG structure, Mark will start recruitment on the two techs, and we'll have a formal governance call scheduled for next week. I appreciate your trust and your time. Questions on next steps?"

---

## DESIGN BRIEF FOR DESIGNER

- **Color palette:** Professional, modern (recommend blue/teal primary, gray secondary, white background)
- **Typography:** Sans-serif (Helvetica, Inter, or similar); consistent hierarchy
- **Charts/diagrams:** Use infographics for the portfolio, tech stack, and resource allocation; keep tables clean and readable
- **Consistency:** Same layout grid across all slides; consistent callout/highlight colors
- **Accessibility:** High contrast, readable font sizes (min 24pt for body, 32pt+ for headers)
- **Timeline:** 30-minute turnaround from outline to PDF
- **Deliverable:** PowerPoint (.pptx) or Google Slides link

---

## MEETING LOGISTICS CHECKLIST

- [ ] Send outline to designer by 5 PM Feb 23; request draft by 10 PM
- [ ] Load slides on Christian's laptop; test AV setup by 2:15 PM Feb 24
- [ ] Print 1-page handout summary for each attendee (6 copies)
- [ ] Have backup slides (PDF on USB) in case of projector failure
- [ ] Recording: Ask Todd if recording is OK; if yes, set up recording device
- [ ] Follow-up: Schedule VG formalization call (John) and governance call (all) for Feb 26–27

---

**End of Outline**
