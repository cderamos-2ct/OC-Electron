# All-Hands Q&A Guide
**Anticipated Questions & Responses** | **For Christian**

---

## GENERAL STRATEGY FOR Q&A

1. **Listen fully.** Don't interrupt. Let the questioner finish.
2. **Acknowledge the concern.** "That's a fair question" or "Good point."
3. **Answer directly.** Use data when possible. Be honest if you don't know.
4. **Offer to follow up.** If you don't have the answer: "Let me research that and get back to you by [date]."
5. **Tie back to strategy.** Remind them how the answer connects to the platform vision.

---

## KLIPPA & EXTRACTION QUESTIONS

### Q: "What if Klippa sues us for breach of contract?"
**A:** "Good legal question—John can speak to the specifics, but our contract with Klippa doesn't prohibit us from building our own extraction. They know we're using them as a vendor, not an exclusive partner. We're not violating IP; we're not reverse-engineering their code. We're just saying, 'We need better accuracy, so we're building our own.' They've known that's a risk in the vendor relationship."

**Backup:** "If there's legal risk, John will surface it. But I'm not worried about this one. Klippa doesn't own the concept of document extraction."

---

### Q: "What happens if Claude API pricing changes?"
**A:** "Valid concern. We're monitoring Claude pricing closely. Right now, we're 40% cheaper than Klippa per document. Claude would have to increase pricing by 5x for us to break even with Klippa. Unlikely, but we're not betting the company on Claude alone. We have alternatives: open-source models (Llama, Mistral), other LLM providers (OpenAI GPT, Anthropic competitors). The key insight is that we own the extraction logic now, so we can swap providers if pricing becomes an issue."

**Backup:** "The cost advantage is so strong right now that even if Claude went up 2x, we'd still be ahead. And we're not locked in."

---

### Q: "What if Claude-based extraction doesn't hit 95%?"
**A:** "Then we have a fallback: Klippa. We're running both in parallel through Phase 2, so we have zero production risk. If our testing was wrong, we catch it early, iterate, and keep using Klippa longer. But I'm confident in the 95% number—we've tested on real documents from City of LA and POP System, and the results are clear."

**Backup:** "We have a B plan: synthetic data + contractor labeling. More expensive, but it works. We're not stranded."

---

### Q: "Why is Klippa's table extraction failing so much?"
**A:** "Because vendors format tables differently. One client sends a 5-column invoice. Another sends a 10-column PO with merged headers. Klippa has a rigid table parser that expects consistent formatting. Real-world documents don't follow that pattern. Our Claude-based extraction is more flexible because we can write custom logic per vertical—one extraction profile for invoices, another for POs, another for specs. That flexibility is what buys us the 95% accuracy."

**Backup:** "It's not Klippa's fault—it's the nature of generic extraction. They solve 80% of cases well. We need 99% of cases solved, so we need a custom approach."

---

## TIMELINE & DELIVERY QUESTIONS

### Q: "Can you really ship Clarity by March 10?"
**A:** "We're 90% complete with 15 days of buffer. The critical path is database optimization and integration testing. Both are on track. If something breaks, we have fallbacks—we can soft-launch to a subset of users and expand. But no, I'm not worried about hitting the date."

**Backup:** "We've shipped products before. This is well-managed. I wouldn't commit to a date I wasn't confident about."

---

### Q: "What if Clarity launch slips?"
**A:** "Plan B: We do a soft launch to 2–3 trusted customers (City of LA, POP System) on Mar 7–10, gather feedback, then do a full platform launch two weeks later. But I don't expect this to be necessary."

**Backup:** "Every day of delay is a day we're not scaling. So we've built this with redundancy and fallbacks. But the date is solid."

---

### Q: "When is extraction module in beta?"
**A:** "April 30. That's when we have enough labeled data from the annotation partnership to have high confidence in the model. We're not shipping extraction to customers until we're at 95%."

**Backup:** "We'd rather ship late and correct than ship early and damage customer trust."

---

## RESOURCE & COST QUESTIONS

### Q: "Why do we need two more technicians? Can't we just hire developers?"
**A:** "Because developers are expensive and context-switching kills productivity. Two technicians at $1,500–2,000 each per month can handle customer support, data QA, and document validation. That frees our developers to focus on platform and extraction. The ROI is simple: each developer we free up is worth $3–5K in value. So we pay $3–4K to get $15K+ of dev productivity back. That's a 4:1 return."

**Backup:** "It's not about headcount—it's about leverage. Technicians are force multipliers."

---

### Q: "What's the total cost of the platform build?"
**A:** "Clarity is already built (it's a sunk cost). The ongoing costs are: Clarity hosting (~$2K/month on AWS), Claude API for extraction (~$500–1K/month depending on volume), team salary (~$11.2K/month), plus the +2 technicians (~$3–4K/month). So roughly $17K/month all-in to run the platform and support 9 active projects. For context, POP System alone is $105K in revenue. The math is healthy."

**Backup:** "We're profitable on active projects. The platform investment is about scaling faster, not about going broke."

---

### Q: "Who's paying for the annotation partnership?"
**A:** "The partners are. They're already paying us to annotate their documents (it's part of the project scope). We're just redirecting that labeled data into training data for our models. So we're not incurring extra cost—we're repurposing work they were already paying for."

**Backup:** "It's a clever arbitrage: we get paid to label, we get training data for free."

---

## GOVERNANCE & DECISION QUESTIONS

### Q: "What happens if Christian and I disagree on project prioritization?"
**A:** "That's what the governance structure is for. We'll have a monthly prioritization call with all partners. You bring your priorities, I'll bring mine, we align on what goes to 'Approved' and what goes to 'Backlog.' If there's a tie, Todd (Principal Partner) breaks it. But we'll have explicit criteria: revenue impact, technical risk, strategic alignment."

**Backup:** "I'm not trying to hide from accountability. I want visibility into how you're thinking about priorities. That governance call is good for all of us."

---

### Q: "What if the technician hire doesn't work out?"
**A:** "We'll know in 4 weeks. If they're not delivering, we terminate the contract (PrintDeed is month-to-month) and iterate. But I expect this to work. We need this role, and PrintDeed's pipeline is solid."

**Backup:** "The contract is flexible. We can adjust if needed."

---

## STRATEGY & VISION QUESTIONS

### Q: "Why are we investing in four verticals instead of going deep on one?"
**A:** "Because they share infrastructure but have different GTM. BPO and Manufacturing are close to revenue. Legal is a proof point. Medical is a land grab for future growth. Spreading across four verticals reduces risk—if one market softens, we have others. Plus, the shared platform makes this economical. We're not building four separate products; we're building one platform with four configurations."

**Backup:** "This is portfolio strategy, not diversification chaos. There's a method."

---

### Q: "What's the long-term vision for this platform?"
**A:** "A SaaS platform that every vertical can use, every client can configure, and we can scale predictably. Over the next 12 months: extraction, validation, workflow automation, compliance rules engine. By year two: predictive analytics, client-specific customizations, white-label offerings. We're building a real platform business, not a services grind."

**Backup:** "This is a 3–5 year play. We're not trying to hit all of it in the next 90 days."

---

## RISK & ACCOUNTABILITY QUESTIONS

### Q: "What could go wrong?"
**A:** "Three scenarios: (1) Clarity launch slips more than 30 days—unlikely, but possible. Fallback: soft launch. (2) Extraction accuracy doesn't hit 95%—unlikely given our testing, but possible. Fallback: keep using Klippa longer. (3) A key team member leaves—always a risk. Mitigation: we document everything, we cross-train, we have backup. None of these are extinction events, but they're real."

**Backup:** "I'm not pretending this is risk-free. But we've planned for the main failure modes."

---

### Q: "How will you measure success in the next 90 days?"
**A:** "Three metrics: (1) Clarity launches Mar 10 and handles multi-tenant load without issues. (2) Extraction module is in beta by Apr 30 with 95% confidence on test set. (3) Three verticals are generating revenue by Jun 30. If we hit all three, we're on track."

**Backup:** "I'll give you a monthly update. You'll see the evidence."

---

### Q: "What's your accountability if these timelines slip?"
**A:** "I own the platform roadmap. If we miss the dates, we replan and communicate why. I'll give Todd and Mark monthly updates on what's on track and what's at risk. If something is systematically failing, we adjust the scope or timeline, not the accountability. I want you to know what's happening, not be surprised."

**Backup:** "I'm not asking you to trust blindly. I'm asking you to trust the process."

---

## MEDICAL VERTICAL QUESTIONS

### Q: "Why should we pursue medical if we haven't sold it yet?"
**A:** "Two reasons: (1) It's a land grab. Competitors aren't focused on document intelligence for healthcare yet. If we move now, we own that segment. (2) Margin is 40–50% vs. 25–30% in BPO. One $50K/year medical customer is worth three BPO customers. But it requires expertise in compliance, healthcare ops, and regulatory knowledge that we don't have yet. That's the trade-off."

**Backup:** "It's high risk, high reward. We need to decide if we have the appetite for that bet."

---

### Q: "What resources do we need to pursue medical?"
**A:** "A product manager or customer success person with healthcare experience, someone to handle HIPAA compliance, and a sales person who can navigate healthcare procurement. Call it 2–3 additional FTE. Budget: $80–100K annually. Timeline: 6 months to first revenue if we move fast."

**Backup:** "It's not a small bet. That's why we're making the go/no-go decision today."

---

### Q: "What if we defer medical until Q3?"
**A:** "We lose market timing. Someone else enters the space. But we also reduce complexity and focus on proving BPO and Manufacturing first. That's a reasonable trade-off if the partners want to be more conservative."

**Backup:** "Both paths are defensible. We just need to decide which one."

---

## VG (VERSE GRAPHICS) QUESTIONS

### Q: "What does VG formalization actually mean?"
**A:** "It means: legal clarity on the relationship between Verse Graphics and our division. Who owns the IP? Who has decision-making authority? What happens if one party wants to exit? What's the liability structure? Right now, it's ambiguous. John will draft an agreement that makes it explicit."

**Backup:** "It's boring legal work, but it's essential. We can't scale without clarity."

---

### Q: "Why hasn't this been formalized already?"
**A:** "Because we've been heads-down building. But now that we're scaling, the ambiguity becomes a blocker. Partners need to know who they're partnering with. Customers need to know who owns their data. It's time to codify it."

**Backup:** "Better late than never. John will move fast on this."

---

## CLOSING QUESTIONS

### Q: "What do you need from us right now?"
**A:** "Four things: (1) John, formalize VG by March 1. (2) All of you, commit to a governance process for project prioritization. (3) Mark and Craig, approve budget for +2 technicians. (4) All of you, decide on medical—go or defer. If we get these, we move very fast."

---

### Q: "When will we see the next update?"
**A:** "Weekly status email, every Monday. Monthly deep-dive if you want. I'll track platform milestones, project status, and team capacity. Full transparency."

---

### Q: "How do we handle urgent requests that don't fit the governance structure?"
**A:** "They go to the monthly governance call with justification. If it's a true emergency (customer crisis, competitive threat), you escalate to me directly. But we'll keep those rare. The governance structure is designed to prevent constant firefighting."

---

## IF YOU DON'T KNOW THE ANSWER

**Script:** "That's a great question. I don't have a good answer off the top of my head. Let me research that and get back to you by [specific date]. I'll send an email with the details."

**Then actually follow up.** Don't leave questions unanswered.

---

## TONE & BODY LANGUAGE DURING Q&A

- **Posture:** Stand comfortably, weight on both feet. Don't fidget or pace.
- **Eye contact:** Look at the questioner while they're asking, then scan the room while answering.
- **Pace:** Speak a little slower than normal. Let your words land.
- **Confidence:** You know this material. It's OK to say "I don't know" if you don't. It's not OK to bluff.
- **Humility:** Acknowledge concerns. Don't dismiss worries as unfounded.

---

**You're ready. Good luck.**

