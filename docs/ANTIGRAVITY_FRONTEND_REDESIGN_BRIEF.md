# Credora: complete frontend redesign brief for Antigravity

> **UI direction superseded:** Use [ANTIGRAVITY_UI_REFINEMENT_V2.md](ANTIGRAVITY_UI_REFINEMENT_V2.md) for all visual design, navigation, page composition, visible copy, and execution prompts. It responds to the owner's screenshots after the first implementation. Retain this document's backend/blockchain preservation constraints as technical reference; do not reintroduce its superseded UI or repeated prototype branding.

Prepared for the Credora repository on 4 November 2026.

## 0. Your assignment and how to use this document

You are the product designer and frontend engineer responsible for redesigning Credora. Implement this brief in the existing repository. Deliver a coherent, usable, responsive application with proper pages, clear navigation, understandable financial information, and working existing integrations.

The owner rejected an earlier single-dashboard illustration because the product structure and available functionality were unclear. Do not reproduce that illustration or treat its layout as approved. This brief replaces that illustration as the implementation direction. The owner wants a real introductory website followed by distinct pages for profile, credit, borrowing, loan management, lending, and review operations.

Read this entire document before editing. Inspect the current code because files may have changed since the brief was prepared. The source is authoritative for available operations and business rules; this document is authoritative for the intended presentation and user journeys. If a proposed display cannot be supported by current data, show an honest limitation or adapt its presentation. Never invent a backend capability to make a screen look complete.

Work through the implementation phases in section 13. Keep `docs/frontend-redesign-progress.md` with completed work, remaining work, baseline issues, and actual verification results. Continue through the phases without stopping after the landing page or asking the owner to choose every component detail. Request clarification only for a concrete issue that prevents safe progress; continue independent frontend work meanwhile. If your context becomes short, save progress and use the resume prompt in section 16.

The deliverable is working application code, not a design report, a screenshot, a standalone HTML mockup, or a new project beside the existing frontend. Do not deploy, publish, push, or initiate public-network transactions as part of this redesign.

### Definition of a successful redesign

1. A new visitor understands who Credora is for, what it demonstrates, and how to enter the right workspace.
2. A borrower has a dedicated profile page and can distinguish profile creation, on-chain registration, a simulated score, an assessed score, and an attested score.
3. Loan amount, total interest, total repayment, payment dates, and current status are easy to understand.
4. Existing repayment, recovery, dispute, lending, and operator actions remain reachable and behave correctly.
5. Each page has its own useful purpose and a clear next action. The app is no longer one large dashboard with repeated buttons.
6. The frontend preserves backend payloads, contract operations, exact amounts, role checks, and transaction confirmation semantics.
7. Desktop, tablet, phone, light mode, dark mode, and keyboard interactions receive actual verification.

## 1. Understand the product before styling it

Credora, also called REBOUND in the repository, is an academic micro-lending prototype. The stated audience is students and early-career researchers who may need short-term bridge funding and have limited conventional credit history.

Its important ideas are:

- **Explainable credit:** five weighted factors and readable reasons for a score.
- **Shared lending:** lenders contribute to a pool instead of selecting individual borrowers.
- **Transparent borrowing:** eligibility, quotation, repayment, and loan states have explicit rules.
- **Contestable decisions:** a borrower can dispute an assessment.
- **Recovery:** an eligible overdue loan can enter an officer-approved restructuring process.
- **Verifiable actions:** on-chain transactions use wallet signatures and confirmed receipts.

This is an academic prototype using valueless test mUSDC, not a real-money banking service. Communicate that naturally and consistently. Do not create imagery, claims, testimonials, guarantees, university partnerships, audits, or adoption statistics that imply a production financial institution.

### Personas and their main questions

| Persona | Questions the interface must answer |
| --- | --- |
| Visitor | What is Credora? Who is it for? How does it work? Can I explore without a wallet? |
| New borrower | What do I need to do first? What information is collected? What does registration mean? |
| Assessed borrower | Why did I receive this score? What is my eligible amount? Is the score saved or attested? |
| Active borrower | What do I owe next, when, and how do I pay? What remains afterward? |
| Overdue borrower | What is overdue? What can I do now? Am I eligible to request a revised schedule? |
| Lender | What is my position worth? How much can I withdraw? How is the pool being used? |
| Reviewer/operator | Which cases require action? Do I have the required role? What exactly will my decision change? |

### Preserve the two operating modes

**Demo mode:** simulated actions, using the existing backend demo endpoints or in-browser store as currently implemented. It must remain usable without a wallet. No transaction hash, confirmation receipt, verified identity, real disbursement, or chain success may be invented for a demo action.

**On-chain mode:** reads and transactions against the configured Sepolia or local Hardhat network. Transactions use the existing wallet and contract execution layer. An unavailable network must never silently display a successful demo outcome.

An API-backed profile or assessment is still not automatically an on-chain record. A chain registration can succeed while backend receipt verification remains incomplete. Design for these distinctions instead of compressing them into a single green "Verified" badge.

## 2. Non-negotiable integration boundaries

### 2.1 Establish a baseline

Before editing:

1. Read applicable `AGENTS.md` files, repository and frontend READMEs, `docs/manual-testing.md`, and the actual files listed in section 12.
2. Inspect `git status` and the current diff. Preserve existing user changes. At brief preparation, `LendingPool.tsx` already contained uncommitted work and a `.lender-head.tmp` file existed; the state may now differ. Do not assume either belongs to your implementation or delete them automatically.
3. Record the current frontend check results before redesign. Distinguish baseline failures from regressions.
4. Inventory every existing action and where it will live afterward. Use section 12 as a starting point, not a substitute for checking current code.
5. Confirm which data comes from the backend, browser store, and chain. The same interface name does not imply identical persistence in all modes.

Do not overwrite unrelated changes, run destructive resets, rebuild the repository from a template, or copy in a replacement frontend that ignores the original handlers.

### 2.2 Protected surfaces

Treat these as read-only for this redesign:

- `backend/`: routes, schemas, services, models, database/migrations, and tests.
- `contracts/`: Solidity, deployment configuration, scripts, manifests, and tests.
- `frontend/src/web3/generated/`: generated ABIs and deployment data.
- Existing environment files, secret files, addresses, chain IDs, RPC settings, confirmation counts, and transaction timeouts.

Reuse, and avoid changing the behavior of:

- `frontend/src/api/client.ts` and its payload/response contracts.
- `frontend/src/web3/actions.ts`.
- `frontend/src/web3/transactions.ts`.
- `frontend/src/web3/useContractTransaction.ts`.
- `frontend/src/web3/units.ts`.
- `frontend/src/web3/config.ts`, `contracts.ts`, and `Web3Provider.tsx`.
- Wallet authentication and challenge signing in `AuthContext.tsx`.

UI components under `components/web3/` can be restyled and split into presentational sections, but their transaction handlers, validations, contract calls, amount parsing, and permission predicates must survive. A small additive read hook or UI adapter is acceptable only when needed for a specified page, using existing contract methods and preserving all existing checks. Do not turn an additive read into an unrelated Web3 refactor.

If an actual backend or contract bug blocks a feature, record the finding and preserve an honest UI state. Do not change the protocol to make your preferred screen work. Complete the rest of the redesign.

### 2.3 Preserve these behaviors exactly

- All writes continue through `useContractTransaction().run(...)` and existing `steps.*` operations.
- The wallet signs. Never put private keys into the frontend or replace signing with a fabricated signature in on-chain mode.
- Preserve `prepared`, `submitted`, `pending`, `confirmed`, and `failed` states. A submitted hash is not success.
- Only a successful result from the existing execution engine may trigger confirmed-success UI.
- Preserve exact approvals, allowance checks, expected-chain checks, expected-contract checks, confirmation depth, replacement handling, and failure classification.
- Use `toUsdcUnits` and bigint amounts for settlement. Never round a display amount and feed it back into a transaction.
- Keep the last-installment remainder, interest calculations, duration rules, eligibility rules, grace/default periods, and recovery calculations intact.
- Keep identity receipt synchronization through `api.syncIdentity`. A saved profile does not complete that operation.
- Preserve contract role checks. Selecting "Reviewer" in the UI changes the workspace, not the wallet's permissions.
- Preserve recovery eligibility, duplicate-request prevention, and milestone completion requirements.
- Keep private profile text, dispute reasons, and decision notes off-chain; reuse the existing hash helpers and ID encodings.
- Keep query invalidation/refetch after transactions. Do not replace it with a fabricated local balance update.
- Preserve queued-versus-funded loan outcomes by reading the existing receipt events.

### 2.4 Important capability limits already found

- The backend profile registration service returns a conflict for an existing profile. It is not an edit-profile endpoint. Provide create and view states; do not invent a working "Save profile changes" operation.
- Financial evidence currently consists of normalized scores and metadata. There is no established document-upload or bank-linking workflow. Do not add a fake upload dropzone, account aggregator, OCR, KYC, email verification, or student-ID verification.
- Demo lender deposits/withdrawals and dispute operations currently use the browser store through API-client methods. Do not describe them as persistent backend workflows unless the current implementation has actually changed.
- The borrower chain hook exposes an open loan, not a complete indexed historical loan list. Do not fabricate on-chain loan history or spend the redesign building an indexer.
- The dispute and recovery queue hooks currently read a recent window of up to 25 records. Label a recent window honestly; do not claim its count represents all historical cases.
- `loansOriginated` comes from a monotonically increasing loan ID counter. It is not a count of currently active loans.
- The current chain position value is available, but the hook does not provide a complete personal deposit/withdrawal ledger. Do not substitute zeros for unavailable cost basis or calculate personal profit from missing history.
- On-chain dispute records may expose reason/decision hashes without the original text. A hash cannot be decoded into a reason. Show the available identifier and explain that source text is unavailable in this interface when appropriate.

## 3. Information architecture: distinct, addressable pages

Keep React/Vite and the existing providers. This is a multipage user experience within the current single-page application, not a request for separate backend-rendered applications.

Use addressable client routes. Prefer hash-based routes for this assignment so deep links work without changing hosting rewrite rules. A small centralized hash router is sufficient; if an established compatible router is already present, reuse it. If adding a router, verify compatibility, keep the dependency addition narrow, and update only the frontend lockfile. Do not upgrade the stack as part of routing.

The table shows route paths; with hash routing, `/borrower/profile` appears as `/#/borrower/profile`.

| Route | Page | Main purpose |
| --- | --- | --- |
| `/` | Landing | Introduce the problem, product, academic context, and entry points |
| `/how-it-works` | How Credora works | Explain scoring, lending, repayment, disputes, and demo/testnet distinctions |
| `/borrower/overview` | Borrower overview | Show current standing and the next useful task |
| `/borrower/profile` | My profile | Create/view profile and manage existing identity-registration flow |
| `/borrower/credit` | Credit profile | Explain saved and attested assessments, validity, and history |
| `/borrower/credit/simulator` | Score simulator | Adjust normalized inputs and save an assessment through the existing flow |
| `/borrower/borrow` | Request a loan | Configure terms, review a quote, and submit the existing request |
| `/borrower/loans` | My loans | List available demo records or show the current on-chain loan |
| `/borrower/loans/:loanId` | Loan details | Repayment schedule, balances, status, and existing actions for a known loan |
| `/borrower/support` | Disputes & recovery | Assessment dispute history/submission and eligible repayment-support entry |
| `/lender/overview` | Lending pool | Personal position, pool health, deposit and withdrawal workflows |
| `/reviewer/disputes` | Dispute queue | List and inspect cases, record existing decisions |
| `/reviewer/attestations` | Score attestations | Existing operator score-publication form |
| `/reviewer/loans` | Loan operations | Existing loan lookup, funding, overdue, and default operations |
| `/reviewer/recovery` | Recovery queue | Existing recovery decisions and milestone actions |

Do not turn every dialog into another page. Deposit/withdrawal, payment review, dispute submission, and recovery submission can be focused dialogs or page-local panels. Complex reviewer case details can use a wide detail panel. Do not add empty Settings, Notifications, Analytics, Team, KYC, or transaction-history pages merely to fill navigation.

### Routing requirements

- Every navigation destination has a meaningful heading and working URL.
- Back, Forward, refresh, and opening a deep link work.
- Unknown routes show a small not-found state with a path home.
- Update the document title for the page.
- Set the active navigation state from the route, not duplicate unrelated component state.
- On page navigation, put focus at the main page heading and handle scroll deliberately. Opening a disclosure or dialog is not full-page navigation.
- Do not send IDs, addresses, amounts, or mode values from a URL directly into a write operation. Validate and resolve them through existing data/permission checks.
- On-chain detail routes use a known ID and current reads. If an ID is absent, invalid, or belongs to another borrower, do not present repayment as if it were the connected borrower's loan.
- After repayment clears the open-loan reference, preserve a confirmed outcome and a known loan-detail link where supported. Do not instantly replace success with "No loan" and erase the context.
- Mode, wallet, and role changes must invalidate or scope account-specific presentation state. No stale borrower's name, score, loan, or quote may remain actionable for another account.

## 4. Application shells and navigation

### Public website shell

Use a slim header with the Credora wordmark, How it works, For borrowers, For lenders, and one "Explore demo" action. "For borrowers" and "For lenders" may be anchors to useful landing-page sections. Do not put the entire operator navigation and simulated wallet address into the public header.

The footer contains the academic-prototype label, How it works, workspace entry links, and a repository/documentation link only if a real destination is already established. No fake contact email, legal certification, customer-support hours, or dead social icons.

### Workspace shell

Desktop: a restrained left sidebar around 224px wide, compact top bar around 64px tall, and a main content column. The top bar contains workspace selection, visible mode/network status, theme control, and the real wallet control when relevant. The sidebar contains only the current workspace's navigation.

Borrower sidebar: Overview, My profile, Credit profile, Request a loan, My loans, Disputes & recovery. Place the simulator inside Credit profile rather than as a competing top-level destination.

Lender sidebar can be short: Lending pool, plus How it works and a switch-workspace entry. Do not manufacture a second lender dashboard to make the sidebar longer.

Reviewer sidebar: Disputes, Score attestations, Loan operations, Recovery. Show actual on-chain roles in a compact account/permissions area. Demo mode does not need fake role certification.

Tablet/phone: collapse the sidebar into a labelled menu before the desktop header becomes crowded; use approximately 1024px as the starting breakpoint and verify intermediate widths. The mobile bar prioritizes brand/menu and a concise mode label. Wallet details can expand from an accessible control. Do not squeeze all desktop navigation items into one row or abbreviate unrelated destinations into ambiguous single words.

Use "Demo", "Sepolia testnet", or "Local testnet" according to actual configuration. Never label testnet mode simply "Live". The mode switch must look interactive and explicitly name both choices; a subtle status badge should not unexpectedly switch the entire application's data when clicked.

Keep the global transaction panel mounted above route content, inside the required providers. Page navigation must not discard a pending transaction. If the existing mode setter clears transaction status, guard mode changes during a transaction rather than pretending switching mode cancels it.

## 5. Visual design specification

### 5.1 Direction

Build a considered academic-finance product: clear, confident, approachable, and precise. The public website should explain the human need and invite exploration. The application should make information and actions easy to scan. They share one identity but need different compositions.

Do not solve every section with three equal cards. Do not produce a giant centered headline, a glowing gradient, four arbitrary metrics, six icon cards, and a repeated CTA as the entire site. Equally, do not make the app so minimal that users cannot tell what it does. Each page must contain the explanatory detail needed for its task.

Use a warm, near-white canvas, deep ink text, a restrained navy-blue primary action, and muted teal for supporting data visualization. This is a deliberate starting direction rather than a requirement to imitate the earlier teal illustration. Use consistent semantic tokens throughout; no page-specific rainbow palettes.

### 5.2 Tokens

Define semantic CSS variables centrally and map Tailwind utilities to them where appropriate for the installed Tailwind version.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F5F6F3` | `#10171D` | Application background |
| `surface` | `#FFFFFF` | `#172129` | Forms, dialogs, bounded task panels |
| `surface-subtle` | `#EDF1EF` | `#202D36` | Quiet selected areas and secondary surfaces |
| `text` | `#17252D` | `#EAF0F3` | Main text |
| `text-muted` | `#56636B` | `#AABAC4` | Supporting readable text |
| `border` | `#D5DDDA` | `#3A4B56` | Structural dividers; not automatically sufficient for every control boundary |
| `primary` | `#203A5F` | `#B6D0F1` | Primary actions and active emphasis |
| `primary-hover` | `#152D4D` | `#CCDEF5` | Hover state |
| `on-primary` | `#FFFFFF` | `#14263C` | Text on primary action |
| `accent` | `#256A65` | `#8AC8BE` | Deliberate chart or secondary emphasis |
| `success-text` | `#21633D` | `#A6D9B6` | Confirmed/paid states |
| `success-bg` | `#EDF7F0` | `#173425` | Success background |
| `warning-text` | `#805315` | `#F1CF8E` | Action required/pending review |
| `warning-bg` | `#FFF5E2` | `#382D1A` | Warning background |
| `danger-text` | `#A32E35` | `#F2B1B5` | Errors/overdue/destructive actions |
| `danger-bg` | `#FCEEEF` | `#3B2026` | Error background |

Measure contrast for actual foreground/background combinations. Token presence is not proof of accessibility. Never use faint muted text for essential amounts or disabled-looking styling for an available primary action. Status labels must carry meaning in words as well as color.

### 5.3 Typography

- Keep Inter as the application font; it is already configured. Use a reliable system fallback.
- Optionally introduce Source Serif 4 only for the landing-page main headline or one editorial statement. If unavailable, use Georgia. Do not mix serif into controls, tables, and monetary figures.
- Landing headline: approximately 56–64px desktop, 36–42px phone, line height 1.08–1.15, readable line breaks.
- Workspace page heading: 28–32px desktop, 24–28px phone, weight 600.
- Section heading: 18–20px, weight 600.
- Body: 15–16px with 1.5–1.65 line height.
- Table/control text: 14–15px. Form inputs should be at least 16px on phone widths.
- Supporting labels: 13–14px. Reserve 12px for genuinely minor metadata; no routine 10px financial labels.
- Important amount: 32–40px only when it is the page's main value.
- Use weights 400, 500, and 600 for most content; avoid making everything bold.
- Use tabular numerals for aligned amounts/dates. Reserve monospace for addresses, hashes, IDs, and technical disclosure.
- Use sentence case. Avoid paragraphs of all-caps micro-labels.

### 5.4 Geometry and composition

- Public content maximum width: approximately 1180–1240px.
- Workspace main content: approximately 1120px maximum; form content can be narrower.
- Reading/form column: 620–720px; quote summary: 320–380px when side-by-side fits.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Use deliberate grouping instead of arbitrary repeated padding.
- Page gutters: 16–20px phone, 24px tablet, 32–40px desktop.
- Control radius: 6–8px. Main panel radius: 10–12px. Pills only for short statuses, not every container.
- Buttons and primary form inputs: roughly 44–48px high. Dense secondary desktop controls may be smaller where still usable.
- Table rows: roughly 48–56px; right-align numeric columns and keep units clear.
- Shadows: subtle for overlay elevation, minimal for ordinary content. Borders and spacing should do most of the grouping work.
- Use at most one prominent filled action per task area. Row actions in a queue are legitimate repeated controls; do not remove functional actions merely to enforce a literal one-button-per-page rule.
- Icons: one consistent Lucide family, typically 18–20px, used when they help recognition. No decorative icon inside every stat, sentence, or button.
- Motion: short feedback transitions, roughly 120–180ms. No looping pulses on ordinary demo badges, count-up balances, animated background blobs, or entrance animation that delays reading. Respect reduced-motion preferences.

Light mode is the primary design review surface; fully support dark mode with the same hierarchy. Preserve a user's saved theme. For a new user, use system preference or a documented light default rather than blindly overwriting stored preferences.

## 6. Public pages: detailed requirements

### 6.1 Landing page

**Purpose:** explain the project and offer clear entry paths. This is not the borrower dashboard and must not require a wallet to read.

Recommended composition, in order:

1. **Public header:** wordmark, simple navigation, Explore demo.
2. **Asymmetric hero:** left-aligned message in roughly 55–60% of the space; a purposeful product example in the rest. Suggested headline: "Small loans. Clear decisions." Supporting copy: "An academic prototype exploring transparent credit and short-term lending for students and researchers." Primary CTA: "Explore borrower demo." Secondary text link: "See how it works." A lender entry can appear directly below as a quieter link.
3. **Concrete example:** a compact, clearly labelled "Illustrative example" showing the relationship between an assessment, a small loan, and repayment. Use consistent sample values from the README if using numbers. Never pretend the example is the viewer's account or a live pool snapshot. A simple repayment statement is more useful than generic 3D coins.
4. **The need:** a short editorial section describing a delayed stipend, conference cost, or temporary funding gap as possible use cases. Do not claim the app verifies those expenses or guarantees approval.
5. **How it works:** a numbered horizontal sequence on desktop, vertical on phone: Build a profile → Understand the assessment → Review and request a loan → Repay or request eligible support. Keep the text short and link to the detailed explanation page.
6. **Why the decision is understandable:** one real-looking factor breakdown using explicitly illustrative data. Explain that five weighted factors contribute to a score and that a saved decision can be disputed. Avoid presenting a radar plot as the only explanation.
7. **For lenders:** a compact section explaining pooled capital, share value, repayment interest, losses, and withdrawal limits in plain language. CTA: "Explore lending pool." Avoid guaranteed-return language.
8. **Recovery and disputes:** give these project differentiators genuine visibility. State that a reviewer considers disputes and eligible recovery requests require approval.
9. **Academic context and FAQ:** concise answers about demo mode, test tokens, the scoring model, wallets, and supported networks.
10. **Footer:** useful navigation and prototype label.

Do not create a decorative statistics ribbon unless every figure has an appropriate source and context. Remove the hardcoded solvency assurance. Do not show "150% collateral" as a universal industry fact or claim this prototype has solved lending risk. Retain technical explanations on the How it works page where they can be accurate and qualified.

**Landing acceptance:** within the first screen a visitor can identify the audience, prototype nature, and main entry action. Subsequent sections explain the actual functionality. Borrower, lender, and reviewer entries work and set the appropriate workspace without silently changing the selected network mode.

### 6.2 How Credora works

Use a readable article-style layout with section links on wide screens and a compact contents disclosure on phones. Include:

- The borrower journey, from profile to repayment.
- The five score factors and their weights: repayment history 35%, affordability 25%, cash-flow stability 15%, debt burden 15%, evidence quality 10%.
- A worked score example using the existing academic model. Make clear that normalized scores are illustrative inputs; do not claim connected bank data or validated predictive accuracy.
- Loan terms and their source. The current documented model uses 12% simple annual interest and 30–365-day requested duration; inspect configured contract parameters before treating a value as current on-chain truth.
- Repayment dates follow the actual schedule. The current contract uses 30-day installment intervals and `ceil(durationDays / 30)` installments. A 365-day requested duration can therefore yield 13 installments; do not quietly "correct" it to 12 or call every interval a calendar month.
- How pooled lender shares work, including idle-cash withdrawal limits and losses.
- What a dispute does in each mode, including score revocation when an on-chain dispute is upheld.
- Recovery eligibility and approval; never imply approval is automatic.
- Demo versus on-chain data and wallet requirements.
- What is stored off-chain and what is represented by hashes on-chain. A hash is not encryption and is not a promise that data can never be identified.

Use accordions only for secondary FAQs, not to hide every core concept. Provide contextual links to the correct application pages.

## 7. Borrower pages: detailed requirements

### 7.1 Borrower overview

**Purpose:** orient the borrower and show the next useful task. This is a summary; detailed forms belong on their own pages.

Header: "Overview", optional actual display name, and one concise status sentence. Avoid a permanent large hero inside the application.

Select primary content from actual state, not arbitrary card order:

| State | Primary content | Primary action |
| --- | --- | --- |
| Data loading | Skeleton with meaningful labels | None until resolved |
| No profile | Setup checklist explaining the next steps | Create profile |
| Profile exists; no saved assessment | Assessment task and what the inputs represent | Explore credit assessment |
| On-chain registration/attestation missing | Specific missing prerequisite, with existing completed steps visible | Register identity / View credit profile, as appropriate |
| Eligible; no open loan | Eligible amount and link to full quotation | Review loan options |
| Loan requested; not funded | Queued status, request ID, available cancellation behavior | View request |
| Active loan | Next amount due, actual due date, remaining balance | Review payment |
| Overdue | Past-due amount and supported resolution choices | Review overdue loan |
| Recovery pending | Request status and existing repayment obligations | View recovery request |
| Repaid/cancelled | Confirmed outcome or available known record | View loan details / Review eligibility |

Include a compact credit summary linking to Credit profile and a compact profile-status row linking to My profile. Do not display the same borrowing limit in two adjacent cards. Do not promote taking a second loan when the contract permits only one open loan.

On mobile, the next task appears before secondary identity details and raw wallet metadata. Never show a warning for an ordinary empty state just because the user has not started yet.

### 7.2 My profile

**Purpose:** make identity and profile setup understandable on a dedicated page.

Create state:

- Display name, required, matching backend limits (currently 2–100 characters after sensible whitespace validation).
- Academic background/about you, optional, matching backend limit (currently 500 characters).
- Connected or demo wallet displayed read-only; do not request it as a second text field if already known.
- Plain-language explanation of what this profile does and what it does not verify.
- Primary action: "Create demo profile" in demo mode; use appropriate existing save/registration wording in on-chain mode.

Existing-profile state:

- Show display name, background, wallet, creation date when available, and separate status rows.
- Profile saved off-chain.
- Identity registered on the configured chain, if confirmed by chain data.
- Backend receipt verified, if actually synced.
- Registration transaction link only when it exists and the configured network has an explorer.
- Explicit retry for backend verification after a successful on-chain registration, using the existing stored transaction reference.

Do not offer profile editing unless the current backend truly supports it. Do not use a registration endpoint to overwrite an existing profile. Do not show a "Verified student" or "KYC passed" badge based on self-entered text or a self-registration transaction.

Keep the existing registration handler's sequencing and receipt-sync behavior when extracting it from `BorrowerPortal.tsx`. Retry verification without asking the wallet to register again when registration already succeeded.

### 7.3 Credit profile

**Purpose:** explain the saved credit decision and its practical implications.

Top section:

- Saved assessment score out of 100, actual risk category, and validity.
- Clear source label: saved demo assessment, backend assessment, or on-chain attestation as supported.
- If both backend and chain assessments exist, show their relationship and any mismatch instead of treating them as interchangeable.
- Eligible amount appropriate to the active mode. In on-chain mode use the chain eligibility result.
- Main action based on state: Calculate assessment, Review loan options, or View attestation requirement.

Main body:

- "Why this score?" with the existing explanation text rendered clearly.
- Five contribution rows with factor name, raw score, weight, and weighted points.
- Small horizontal bars with consistent semantics; label values so the chart is understandable without color.
- Link to the simulator with wording such as "Explore how the factors affect your score".
- Assessment history from `api.getAssessmentHistory()` when available, with dates and states. Do not use this history as proof of on-chain attestations.
- "Disagree with this assessment?" linking to a dispute form tied to that assessment ID.

Preserve the risk thresholds. Do not invent credit advice, income thresholds, or probability-of-default percentages. Do not present the radar reference of 70 as a validated cutoff without a documented source.

An absent/expired score is a clear state with a next step; it is not a score of zero. An outstanding attestation requirement must be visible before the borrower reaches a failed loan form.

### 7.4 Score simulator

**Purpose:** retain the academic demonstration while making its limitations and saved-state behavior clear.

- Keep the existing five inputs and weights.
- Pair sliders with accessible numeric inputs for exact values between 0 and 100. Input changes update the projection only.
- Preserve valid zero inputs; do not use truthy fallback logic that replaces zero with a default value.
- Display a visibly labelled "Projected score" separate from "Last saved assessment".
- Show live weighted contributions and a plain statement that changing a slider does not alter an attested score.
- One primary action saves evidence and creates an assessment through the existing methods. Use "Save demo assessment" or accurate mode-specific wording.
- If unsaved changes exist, indicate them; do not let a projected limit masquerade as current borrowing eligibility.
- After successful saving, show the result and one onward action to Credit profile or loan options. Avoid duplicate borrowing buttons at both the header and chart footer.
- Retain normalized score inputs rather than inventing an income-to-score transformation.
- Explain the direction of debt-burden input: a higher normalized factor score represents the favorable end of the existing model. Do not accidentally invert it because the label contains the word debt.

If on-chain mode allows preparation of off-chain evidence, preserve that behavior while explicitly saying an authorized attester must publish the chain assessment. The borrower cannot attest their own score merely by saving this form.

**States:** initial example projection, existing assessment loaded, dirty inputs, saving, save failed, saved, and attestation still required. All must remain visually distinguishable.

### 7.5 Request a loan

**Purpose:** let the borrower understand and choose the full obligation before submitting a request.

Use a dedicated page with a clear two-stage experience: configure terms, then review/confirm. A compact two-step progress indicator is appropriate here because these are genuinely sequential steps.

**Eligibility block:** resolve loading before deciding the borrower is ineligible. Identify the precise missing prerequisite: profile, registration, valid assessment, attestation, compatible wallet/network, or an existing open loan. Link to the correct page. Do not use a generic error panel for all these states.

**Terms form:**

- Exact amount input with mUSDC unit, optional slider, and a short eligible-limit explanation.
- Keep entered on-chain values as strings until parsed with `toUsdcUnits`. Avoid converting to floating point before settlement parsing.
- Repayment-duration input with convenient presets such as 30, 90, 180, and 365 days, plus an exact supported value entry.
- Derive constraints from existing validations/configuration. Do not impose a new financial minimum because a slider formerly started at 50.
- Ensure 365 is actually selectable. A slider starting at 30 with step 30 does not naturally reach 365; use presets or exact entry rather than retaining a misleading endpoint.
- Use labels like "Amount to borrow" and "Requested duration".

**Quote summary:**

- Amount received, interest rate if supported by current data/configuration, total interest, total repayment, number of installments, and schedule.
- Put total repayment where it is easy to find. Do not emphasize only the periodic amount.
- Backend/demo quote uses `api.getLoanQuote`. On-chain quote uses the existing `LoanManager.quote` read.
- Show an updating state when inputs change. Do not allow submission using a quote for old inputs. Ignore stale responses.
- Dates before funding must be labelled estimates; the actual chain schedule begins when funding occurs.
- Distinguish requested duration from the actual last installment date when the protocol's 30-day schedule produces a difference.
- Routine previews can show readable rounded amounts, but confirmation includes exact mUSDC values and the final-installment remainder where relevant.

Desktop: form on the left, summary on the right. A summary may be sticky only when it fits the viewport and does not hide content. Phone: form, summary, then primary action in reading order; do not create overlapping floating panels.

**Review stage:** show the selected terms, total obligation, mode/network, recipient wallet context, and the action that will occur. Provide Edit terms and one final action: "Simulate loan request" or "Confirm in wallet". Do not add legal consent checkboxes unsupported by a real agreement.

**Outcomes:** distinguish demo request recorded, confirmed request queued, and confirmed loan funded. Preserve receipt parsing for `LoanRequested` and `LoanFunded`. A pending wallet transaction is not a funded loan. Keep the success outcome visible even if refetched eligibility now reports an open loan.

### 7.6 My loans and loan details

**My loans purpose:** a stable destination for loan records available in the active mode. Demo records come from the existing API/store. On-chain view begins with the actual current/open loan and any explicitly known, verifiable record. Do not fill the page with fabricated past loans or call it a complete history.

If only one current on-chain loan exists, use a clear summary row and direct detail link; a large empty table is unnecessary. Available records show ID, amount, status, and due information where real data supports it.

**Loan-detail hierarchy:**

1. Loan identifier, actual status, and source/network.
2. Next payment amount and due date, or queued/repaid/overdue state.
3. Remaining balance and original principal.
4. Supported repayment actions.
5. Repayment schedule/status detail to the extent the current data can establish it.
6. Recovery section if relevant.
7. Technical details disclosure for transaction links, IDs, and exact values.

Reuse `OnChainLoanCard` behavior while reorganizing its presentation. Preserve:

- Claim test mUSDC when appropriate.
- Pay next installment using `nextPaymentDue`'s exact amount.
- Repay in full using the current outstanding value.
- Cancel a queued request when the contract permits it.
- Record overdue status when permitted.
- Request restructuring when eligible and no open request exists.

State labels must follow `LOAN_STATUS` for chain records, not the smaller demo `LoanStatus` union. Keep separate adapters instead of forcing incompatible statuses into one misleading type.

Show late amounts and due dates without accusatory language. Move "Record overdue status" into a contextual technical action area if needed, but keep it available. Do not introduce automatic default marking or restructuring on page load.

Only show paid installment history when confirmed data supports it. A locally inferred remaining count is not a full payment ledger. If the backend lacks a persisted demo repayment method, preserve the demonstrative behavior with clear session/simulation wording; do not label it permanent settlement. Do not mutate a React prop and assume it has become a durable backend record.

### 7.7 Disputes & recovery

**Purpose:** give borrowers an understandable route to challenge a score or seek eligible repayment support.

Use two clearly named sections/tabs: "Credit disputes" and "Repayment support". These are related support tasks but have different records and rules.

Credit disputes:

- Show the assessment being disputed and its status.
- Ask for a reason in a labelled textarea with useful, neutral help text.
- Demo submission continues through `api.disputeAssessment`.
- On-chain submission uses the existing attestation ID and `steps.openDispute` with the existing reason hash.
- Require an appropriate valid record; do not enable a dispute against an unsaved slider projection.
- List accessible records for the current borrower only. Treat a recent queue as recent, not complete.
- Show existing status and reviewer notes only when actually available. Never fabricate reason text from a hash or advertise a response-time guarantee.

Repayment support:

- Explain the current loan state and whether restructuring can be requested.
- If ineligible, show the reason and a useful loan-detail link; do not show a fake active form.
- When eligible, use the existing requested duration/date and reason fields, with accurate outstanding amount.
- Preserve `chainNow`, exact outstanding units, `hashText`, and the existing `steps.submitRecovery` behavior.
- On submission, say approval is pending and show the actual request reference. Do not present the requested schedule as approved.
- Display approved-plan progress only from available reads. No invented milestones, descriptions, or payment completion.
- Do not introduce a demo recovery mutation if no existing interface supports it; explanatory content can identify that the interactive workflow is available in on-chain mode.

Recovery must be discoverable from an overdue loan, not just from a distant navigation item. Keep the same underlying form/action implementation so two entry points cannot drift into different behavior.

## 8. Lender workspace

### 8.1 Lending pool overview

**Purpose:** answer "What is my position, how much can I withdraw, and what is happening in the pool?"

Header: "Lending pool" with a short explanation. Keep one Deposit and one Withdraw action near the position summary. Remove synonyms such as Supply More USDC, Redeem Capital, and Deposit Liquidity for the same actions.

Personal section:

- Current position value.
- Available to withdraw, using `maxWithdraw` in on-chain mode.
- Shares and share of the pool where supported.
- Wallet test-token balance where supported.
- Principal contributed and earned interest only if the current data actually provides them. A missing on-chain personal ledger is not zero contribution or zero profit.

Pool section:

- Total assets, idle liquidity, outstanding borrowed capital, utilization, and observed pool interest/losses where available.
- One simple labelled utilization visualization, backed by current values.
- Keep "loans originated" distinct from "active loans".
- Explain that withdrawal availability depends on idle liquidity and that losses affect share value.
- Avoid a hardcoded "100% solvent", "safe", or "guaranteed" badge.
- If displaying an estimate based on borrower rate and utilization, label it as an illustrative annualized estimate, identify its assumptions, and do not call it guaranteed APY or realized personal earnings. Prefer actual available balances over a weak yield forecast.

**Deposit dialog:** amount, unit, wallet balance when available, optional honest presets, and accurate mode label. Presets set the amount and should read "100", "250", etc. with a clear mUSDC unit; do not prefix them with `+` unless they really add to the amount. Reuse exact approval-plus-deposit steps. Explain when two wallet transactions are required without burdening the main page with implementation prose.

**Withdrawal dialog:** current value and maximum withdrawable amount, exact input, optional Max action, and one confirmation action. Do not allow Max to use total position value when `maxWithdraw` is smaller.

**Test tokens:** a secondary "Get test mUSDC" action uses the existing faucet. Preserve cooldown errors; a rejected faucet call must remain a failed transaction, not a successful mint notification.

**States:** no position, connected position, wallet disconnected, wrong chain, missing configuration, loading, load failure, unavailable idle cash, pending transaction, successful action, failed action. Each needs an explicit design. Never leave `—%` or a full green utilization bar as the only representation of a failed load.

## 9. Reviewer workspace

The current `OperationsConsole.tsx` combines several tasks. Reorganize them into meaningful destinations while preserving their handlers. Extract reusable sections or use an explicit section prop; do not duplicate the whole console four times and hide parts with CSS.

### 9.1 Dispute queue

Use a table on desktop and structured case rows on phones. Useful fields: case ID, borrower identifier, submitted time, actual status, reason excerpt when available, and Review action. Add simple status filtering only over data that is actually loaded. Do not imply server-wide search, pagination, or totals for a limited recent window.

Case detail must show the full available reason, assessment reference, status, existing notes if present, and decision fields. Long reasons must be readable without a tooltip. Use a wide dialog/detail panel or a detail route if that improves usability.

On-chain decisions require the actual reviewer role and notes, then use `steps.resolveDispute`. Explain that an upheld dispute revokes the current attestation; do not say the score was automatically recalculated or improved. A later attestation is a separate operation.

Demo status `resolved_adjusted` is an internal value. Inspect what the store actually changes before saying "Score adjusted". If it records only the resolution, use truthful copy such as "Demo decision recorded".

### 9.2 Score attestations

Use a dedicated form for the existing operator action:

- Borrower wallet address.
- Assessment UUID.
- Score within 0–100.
- Validity days within the current allowed range.
- Clear preview of the account and assessment being published.

Reuse address validation, UUID encoding, `scoreToBps`, chain-time expiry calculation, and `steps.attestScore`. Prefer the real assessment UUID from the existing assessment; do not make a random default look as though it identifies a verified backend record. Preserve actual contract restrictions including self-attestation prevention.

Display the actual held role and explain missing permission. The workspace selector must never unlock the form's transaction action.

### 9.3 Loan operations

Provide a labelled loan-ID lookup and a useful detail panel. Preserve `useLoanLookup` and existing fund/overdue/default handlers and predicates. Show current status and what a proposed action means before confirmation.

Do not imply that all requested loans are enumerated if only lookup exists. Do not fabricate a queue, automated risk ranking, or funding recommendation. Keep the ability to fund a queued loan, mark overdue where allowed, and mark default when permitted by the contract.

### 9.4 Recovery queue

Use case rows showing request ID, borrower, loan reference, actual status, outstanding/proposed amounts, and due information available from the chain.

Detail view contains the actual proposed request, notes field, milestone count, schedule preview derived by the existing `buildPlan`, and Approve/Reject actions. Preserve:

- Required decision notes.
- Recovery officer role check.
- Existing milestone-count range and due-date validation.
- Exact bigint split with the final milestone absorbing the remainder.
- Existing `approveRecovery`/`rejectRecovery` operations.
- Milestone completion only when the contract's repayment requirements are met.

A preview is not an approved plan. A submitted approval transaction is not final. These distinctions must remain visible.

## 10. Shared behavior and component rules

### 10.1 A small consistent component system

Refactor current common components rather than scattering bespoke classes across every page. Useful components include:

- PublicHeader, PublicFooter, WorkspaceShell, WorkspaceSidebar, WorkspaceHeader.
- PageHeader with title, brief context, and optional contextual action.
- Button with primary, secondary, quiet, and destructive variants.
- FormField/Input, NumericAmountField, Textarea, Select, FieldError.
- StatusBadge, InlineNotice, EmptyState, LoadingSkeleton, ErrorState with retry.
- DataTable and mobile record rows.
- Accessible Dialog/Drawer and ConfirmAction panel.
- AmountDisplay, WalletAddress with copy, and actual ExplorerLink.
- CreditFactorBreakdown, LoanSummary, RepaymentSchedule, ModeIndicator.
- Global TransactionStatus presentation using the existing transaction state.

Do not create a giant abstraction framework. Reuse components that actually repeat. Keep financial transformations in existing helpers/data adapters, not hidden in visual components.

### 10.2 Action inventory and hierarchy

Every visible action must do something defined: navigate, submit an existing operation, open a useful form, reveal details, copy an actual value, or retry a failed load. No inert "Learn more", fake download statements, decorative search fields, or placeholder notification bells.

Use real links for navigation and buttons for actions. A clickable tile needs semantic keyboard behavior. Do not use a div with only an `onClick` handler as primary navigation.

Keep repeated navigation and contextual actions when they serve distinct moments. Remove nearby duplicate actions with different labels. In long forms, repeating the same primary action can be justified only when it has the same behavior and does not create conflicting state.

### 10.3 Forms and validation

- Persistent visible labels, helper text where needed, and programmatic label associations.
- Match current backend constraints and chain validation; do not weaken checks in order to simplify the UI.
- Preserve entered values after recoverable errors.
- Put errors beside fields and provide a concise summary for longer forms.
- Prevent duplicate submissions and make progress clear.
- Keep cancellation separate from submitting a financial action.
- A confirmation dialog shows real current values and distinguishes demo simulation from wallet submission.
- Never auto-submit because a slider moved, a route opened, an account changed, or a modal closed.
- If edits invalidate a quote, visibly invalidate submission until the current quote is available.

### 10.4 Loading, empty, error, and stale states

Create explicit view states rather than interpreting every `null`, empty array, or zero as a valid account state. Existing hooks/client methods sometimes hide errors or fall back; inspect their limitations and do not claim more certainty than they provide. Add UI adapters or narrowly scoped read status where necessary without weakening the underlying behavior.

- Loading: skeleton sized to final content, with an accessible description.
- Empty: state what does not exist and give the next legitimate action.
- Error: readable problem and retry where it is safe.
- Stale: retain previous data only with a clear stale/updating indication and protect dependent actions.
- Missing configuration: name the configured environment in user-friendly terms; keep detailed diagnostics in a disclosure.
- Disconnected wallet: explain which task requires connection; public pages and demo exploration stay available.
- Wrong network: reuse the existing network-switch flow and block transactions.
- Forbidden action: explain the missing actual role; never solve it by changing a UI role string.

### 10.5 Transaction presentation

The persistent panel communicates the actual operation, phase, network, relevant amount, and receipt hash when available. Multi-transaction actions show the current step clearly. Distinguish signing an authentication message from submitting a contract transaction.

Keep pending status discoverable while navigating. A user dismissing a notification does not cancel a transaction. Avoid overlap with the page's primary controls on small screens. Preserve available hash-copy and explorer actions. Show timeout/replacement errors honestly and retain a hash that can be checked; do not encourage blind repeated submission.

Success feedback should identify the specific changed state. Update data using the existing refetch behavior. Do not use celebratory animations for a routine loan, debt, or reviewer decision.

### 10.6 Units, dates, and copy

Use mUSDC consistently for the current protocol asset, including demo simulations of that asset. Keep `cpUSDC` shares distinct from mUSDC balances if shares are shown. Do not mix ₹, $, USDC, and mUSDC in the same workflow. A future INR conversion would require explicit data and explanation; it is outside this redesign.

Replace the misleading display-formatter naming carefully. A presentation-only formatter can be introduced and call sites migrated; settlement helpers must remain intact. Do not change numeric semantics merely to change the symbol.

Use unambiguous human dates such as "4 Nov 2026". Do not parse a date-only backend value in a way that shifts its calendar day due to UTC conversion. Preserve exact chain timestamps and define the display timezone consistently. Show full wallet addresses or hashes on demand and offer copy rather than forcing a huge string into a narrow table.

Preferred vocabulary:

| Replace | With |
| --- | --- |
| My Facilities | My loans / Loan details |
| Commit Assessment | Save demo assessment / Save assessment, as accurate |
| Requested Principal | Amount to borrow |
| Repayment Tenure | Requested duration / Repayment period |
| Adjudication | Review / Decision |
| Redeem Capital | Withdraw |
| Supply More USDC | Deposit |
| academic_model=true | Academic scoring model |
| No Active Borrowing Facility | You have no active loan |
| Live | Sepolia testnet / Local testnet |

Do not label a self-registered profile as verified identity. Do not label a prepared score as approved credit. Do not hide an existing workflow behind misleadingly simple language.

## 11. Responsive and accessible behavior

Verify at 360px, 390px, 768px, 1024px, and 1440px widths. Also inspect at 200% zoom. A desktop layout reduced to fit a phone is not a responsive design.

- No page-wide horizontal scrolling or clipped wallet controls.
- Collapse sidebars before header crowding; allow headings and meaningful text to wrap.
- Move quote summaries below forms on phones. A form label must not become a tiny column beside a huge figure.
- Convert suitable tables into labelled record rows on phones. For genuinely wide data, use a contained horizontally scrollable table with a visible cue; do not hide important columns silently.
- Keep monetary values and units together, but allow surrounding labels to wrap.
- Primary tap targets should be about 44px high or larger as a comfort target. WCAG 2.2 AA's minimum target-size criterion is 24 by 24 CSS pixels with exceptions; do not misrepresent 44px as that criterion's universal minimum. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Ordinary text needs at least 4.5:1 contrast and qualifying large text at least 3:1. Measure the rendered combinations in both themes. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Use header/nav/main/footer landmarks, one principal page heading, a skip link, visible keyboard focus, descriptive link names, and meaningful button names.
- Associate inputs, sliders, help text, and errors programmatically. Expose slider values and units accessibly.
- Dialogs need an accessible name, modal semantics, focus entry, contained Tab/Shift+Tab navigation, Escape dismissal where appropriate, and focus restoration. The background must not remain keyboard-interactive. See [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Icon-only controls need accessible names. Color alone must not indicate paid/overdue/selected/error states.
- Announce meaningful async results with appropriate live regions; do not announce every slider frame or refetch.
- Support reduced motion and usable text enlargement.

Do not claim WCAG compliance based solely on this checklist or a single automated scan. Report what was actually checked.

## 12. Repository map and preservation matrix

### 12.1 Read before refactoring

| Existing file/area | Responsibility | Expected redesign treatment |
| --- | --- | --- |
| `frontend/src/App.tsx` | Provider composition, tab selection, top-level data | Replace tab routing with route-aware composition; preserve providers and scoped data updates |
| `frontend/src/contexts/AuthContext.tsx` | Wallet/demo context, auth, profile, transaction status | Reuse public interface; preserve challenge signing and mode/account behavior |
| `frontend/src/contexts/ThemeContext.tsx` | Theme preference | Preserve saved preference; improve presentation/system behavior only as necessary |
| `frontend/src/components/layout/Header.tsx` | Current global navigation and wallet/mode controls | Split public and workspace shells |
| `frontend/src/components/views/LandingPage.tsx` | Current public overview | Rebuild around section 6 |
| `frontend/src/components/views/BorrowerPortal.tsx` | Identity flow, overview, credit/borrow tabs, demo schedule | Extract actual page responsibilities while preserving handlers |
| `frontend/src/components/views/BorrowerDashboard.tsx` | Older overlapping borrower view | Check import graph; do not resurrect unused behavior or treat this as the current canonical flow |
| `frontend/src/components/views/CreditStudio.tsx` | Score projection, evidence submission, assessment creation, dispute | Split credit profile/simulator presentation; preserve actual operations |
| `frontend/src/components/views/LoanMarketplace.tsx` | Quotes, eligibility gates, receipt-based request outcome | Reuse behavior in Request loan page |
| `frontend/src/components/views/LendingPool.tsx` | Demo/chain pool position and fund actions | Redesign around section 8; preserve any existing local changes |
| `frontend/src/components/views/ReviewerDesk.tsx` | Demo dispute list and resolution | Place in mode-aware reviewer pages |
| `frontend/src/components/web3/OperationsConsole.tsx` | Attestations, loan operations, disputes, recovery | Extract sections without altering their financial or permission behavior |
| `frontend/src/components/web3/OnChainLoanCard.tsx` | Borrower loan lifecycle actions | Reuse handlers in loan-detail presentation |
| `frontend/src/components/web3/WalletControl.tsx` | Wallet connection, network notices/switching | Restyle and position while retaining behavior |
| `frontend/src/components/web3/TransactionToast.tsx` | Global transaction progress and receipt UI | Preserve phase meanings and global mounting |
| `frontend/src/components/common/*` | Shared controls and containers | Establish consistent token-driven components and accessible interactions |
| `frontend/src/api/client.ts` | Existing HTTP and demo-store interface | Reuse; do not replace with a second mock API |
| `frontend/src/types/index.ts` | API/domain types | Preserve wire shapes; use separate view models if needed |
| `frontend/src/web3/hooks.ts` | Chain reads and role checks | Reuse; only narrow additive read/status support if needed |
| `frontend/src/utils/cn.ts` | Class merging and presentation formatting | Fix display currency semantics carefully without altering settlement |
| `frontend/src/index.css`, `App.css`, `index.html` | Global styles and fonts | Centralize design tokens and remove obsolete conflicts |
| `frontend/e2e/onchain-smoke.mjs` | Existing functional browser checks | Update selectors/navigation only as needed; keep assertions and coverage |

### 12.2 Action-to-integration matrix

Verify names against current source before using them. This table identifies reuse points, not permission to alter their implementations.

| User action | Existing integration | New location |
| --- | --- | --- |
| Load/create profile | `api.getBorrowerProfile`, `api.registerBorrower`, `refreshProfile` | My profile |
| Register chain identity | `steps.registerIdentity`, `hashText`, existing registration sequence | My profile |
| Verify registration receipt | `api.syncIdentity` and stored receipt reference | My profile |
| Load current/history assessment | `api.getCurrentAssessment`, `api.getAssessmentHistory` | Credit profile |
| Submit evidence/save assessment | `api.submitEvidence`, `api.createAssessment` | Score simulator |
| Read chain eligibility/score/open loan | `useBorrowerChainState` | Overview, Credit profile, Request loan, Loan details |
| Get demo quote/request loan | `api.getLoanQuote`, `api.requestLoan` | Request loan |
| Get chain quote/request loan | Existing `useReadContract` quote, `steps.requestLoan`, receipt-event parsing | Request loan |
| Load demo loans | `api.getLoans` | My loans / Loan details |
| Read known chain loan | `useBorrowerChainState`, `useLoanLookup` where suitable | My loans / Loan details |
| Pay next installment | `steps.repay` with exact `nextPayment` amount | Loan details |
| Repay full balance | `steps.repayInFull` with exact outstanding | Loan details |
| Cancel request | `steps.cancelLoan` | Loan details |
| Record overdue | `steps.markOverdue` | Loan details / permitted operator action |
| Request recovery | `steps.submitRecovery`, `chainNow`, `hashText` | Loan details / Repayment support |
| File demo dispute | `api.disputeAssessment` | Credit profile / Disputes & recovery |
| File chain dispute | `steps.openDispute` with real assessment ID and reason hash | Credit profile / Disputes & recovery |
| Read pool and position | `api.getPoolStatistics`, `api.getLenderPosition`, `usePoolChainData` by mode | Lending pool |
| Demo deposit/withdraw | `api.depositToPool`, `api.withdrawFromPool` | Lending pool dialogs |
| Chain deposit/withdraw | `steps.deposit`, `steps.withdraw` | Lending pool dialogs |
| Get test tokens | `steps.claimFaucet` | Relevant borrower/lender context |
| Read operator permissions | `useOperatorRoles` | Reviewer shell and actions |
| List/resolve demo disputes | `api.listDisputes`, `api.resolveDispute` | Dispute queue |
| List/resolve chain disputes | `useDisputeQueue`, `steps.resolveDispute` | Dispute queue |
| Publish attestation | `steps.attestScore`, `uuidToBytes32`, `scoreToBps`, `chainNow` | Score attestations |
| Find/fund/default loan | `useLoanLookup`, `steps.fundLoan`, `steps.markOverdue`, `steps.markDefaulted` | Loan operations |
| Review recovery | `useRecoveryQueue`, `steps.approveRecovery`, `steps.rejectRecovery` | Recovery queue |
| Complete milestone | `steps.completeMilestone` | Recovery detail |
| Display transaction outcome | `useContractTransaction`, `activeTx`, `TransactionToast` | Global workspace layer |

### 12.3 Suggested frontend organization

Adapt to existing conventions; this is a useful structure, not a demand to rename every file.

```text
src/
  app/
    routes.ts
    navigation.ts
    PublicLayout.tsx
    WorkspaceLayout.tsx
  pages/
    public/LandingPage.tsx
    public/HowItWorksPage.tsx
    borrower/OverviewPage.tsx
    borrower/ProfilePage.tsx
    borrower/CreditProfilePage.tsx
    borrower/CreditSimulatorPage.tsx
    borrower/RequestLoanPage.tsx
    borrower/LoansPage.tsx
    borrower/LoanDetailPage.tsx
    borrower/SupportPage.tsx
    lender/LendingPoolPage.tsx
    reviewer/DisputesPage.tsx
    reviewer/AttestationsPage.tsx
    reviewer/LoanOperationsPage.tsx
    reviewer/RecoveryPage.tsx
  components/
    common/       # actual shared controls
    layout/       # headers, navigation, page framing
    credit/       # factor breakdown, assessment display
    loans/        # schedule and loan presentation
    web3/         # existing integration-aware components
  api/            # existing client retained
  contexts/       # existing providers retained
  web3/           # existing engine, hooks, configuration retained
  types/          # existing API/domain contracts retained
  utils/          # presentation helpers
```

Separate data acquisition and action handling from purely visual sections where it improves clarity. Avoid copying the same form handler into multiple pages. Keep a single source for route definitions, mode labels, and visible status terminology.

## 13. Implementation phases and checkpoints

Execute these in order. At each checkpoint, update the progress document and continue. A phase is complete only when its pages work with the actual existing data/actions; static placeholders do not count.

### Phase A — Baseline and integration inventory

1. Inspect current source, applicable instructions, working-tree changes, and available scripts.
2. Run the existing frontend checks and save factual baseline results.
3. Inventory handlers and map them to routes using section 12.
4. Document known missing capabilities and existing failures separately.
5. Decide the route implementation within the constraints in section 3.

**Checkpoint:** no unexplained existing user changes overwritten; preservation matrix and baseline are recorded. Do not spend this phase writing a second long design proposal instead of proceeding.

### Phase B — Design system, routing, and shells

1. Add central tokens and typography.
2. Improve common Button/Input/Modal/status patterns without breaking their callers.
3. Create public/workspace layouts and route-aware navigation.
4. Preserve provider nesting: ThemeProvider, Web3Provider, AuthProvider as required by their hooks. Keep transaction UI global.
5. Introduce route-specific headings, titles, focus behavior, and mobile navigation.
6. Temporarily mount existing functional views in the new routes while their presentation is replaced, so capability remains accessible during migration.

**Checkpoint:** every route resolves, Back/Forward/refresh work, old operations remain reachable, and the application builds. No giant placeholder dashboard.

### Phase C — Public website and profile

1. Rebuild the landing page and add How it works.
2. Extract profile creation/registration into My profile with all existing states.
3. Implement clean borrower/lender/reviewer entry paths.
4. Correct obvious false/static claims and mixed currency labels encountered in these pages.
5. Inspect wide, intermediate, and phone widths in both themes.

**Checkpoint:** a visitor can explain the project and enter a workspace; profile creation and receipt verification retain their real behavior.

### Phase D — Borrower overview, credit, and quotation

1. Implement the overview state table.
2. Split Credit profile and Score simulator; keep projected/saved/attested values distinct.
3. Build the loan form, exact inputs, quote summary, and review stage.
4. Preserve real eligibility, quote reads, request handler, and receipt outcomes.
5. Test empty/saved/expired/dirty/loading/error states and stale-quote protection.

**Checkpoint:** borrower navigation has a coherent sequence; no dead-end primary action; no invented eligibility; no changed formulas or transaction amounts.

### Phase E — Loan management, disputes, and recovery

1. Add My loans and known-loan detail navigation.
2. Reorganize existing repayment, cancellation, overdue, and restructuring actions.
3. Add borrower disputes/recovery page using current available data.
4. Preserve confirmed outcomes across data refresh and route changes.
5. Validate every applicable loan state, including queued, active, overdue, restructured, repaid, cancelled, and defaulted representations where available.

**Checkpoint:** every original borrower loan action is reachable, uses the original operation, and has an accurate result message.

### Phase F — Lender and reviewer workspaces

1. Rework the lender page and dialogs around position and withdrawable funds.
2. Remove duplicate deposit/withdraw actions and incorrect metric labels.
3. Split operations into the four reviewer routes.
4. Preserve role predicates, IDs, hashing, plan math, and existing decisions.
5. Add truthful limited-data, loading, permission, and error states.

**Checkpoint:** every original operator action is mapped and functional; account/workspace switching does not confer permissions or leak stale data.

### Phase G — Verification, polish, and completion

1. Run the frontend checks below and fix redesign regressions.
2. Update existing browser-test selectors/navigation for the redesigned UI without weakening assertions.
3. Run the complete local integration path when an isolated local stack is available.
4. Inspect the responsive, theme, and keyboard matrix.
5. Remove only obsolete code/assets that you own and have verified unused. Do not remove unrelated temporary files or user edits.
6. Confirm protected backend, contract, generated ABI, and environment files were not changed by the redesign.
7. Record screenshots and actual pass/fail/blocked results. Review the diff for accidental formula or handler changes.

**Checkpoint:** the definition of done in section 15 is met, or each remaining external blocker is precisely documented. Do not claim blockchain integration is verified merely because TypeScript compiles.

## 14. Verification plan

### 14.1 Frontend commands

Run in `frontend/` and record actual results:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Do not paste the historical pass counts from README into your final report. Do not upgrade dependencies to hide errors. If tests were failing before your work, distinguish the baseline and demonstrate that your changes did not introduce further failures.

Meaningful new frontend coverage should focus on navigation and state-sensitive behavior: exact input parsing at the UI boundary, no stale quote submission, correct mode/account scoping, accessible dialog behavior, prerequisite navigation, and preserved action wiring. Avoid tests that only assert a copied CSS class list or mirror implementation details.

### 14.2 Functional walkthrough matrix

| Scenario | Required observed behavior |
| --- | --- |
| Landing without wallet | Product is understandable; links work; demo entry does not require wallet |
| Deep link and refresh | Intended page renders; URL and active navigation agree |
| New demo borrower | Profile creation is clear; empty state does not impersonate a credit rejection |
| Existing profile | View status accurately; no fake edit endpoint or duplicate registration |
| Zero-valued factor | Zero remains zero; projection and saved assessment behave correctly |
| Save assessment | Existing evidence and assessment calls run; saved result is distinct from projection |
| Dirty simulator | Projected values cannot be mistaken for saved or attested eligibility |
| Demo loan quote/request | Existing quote/request operations work; outcome is labelled simulated |
| Amount/duration change | Old quote cannot be submitted; 365-day choice works and schedule is truthful |
| On-chain wallet disconnected | Read/connection state is accurate; write action cannot execute |
| Wrong chain | Correct network is identified; existing switch flow available; write blocked |
| Missing chain config | No demo success or misleading zero balance substituted |
| Identity registered; sync fails | Chain success remains visible; retry sync does not register again |
| Saved score without attestation | Borrower sees the actual missing step; self-publishing is not offered |
| Queued loan request | Shows requested/awaiting funding; no disbursement claim |
| Funded loan request | Shows actual funded outcome and known loan ID from receipt |
| Pay installment / full balance | Exact existing amount and steps used; remaining values refetch |
| Pending action then navigation | Transaction status remains visible and no duplicate write occurs |
| Account/mode switch | Previous account/mode data is not actionable or incorrectly labelled |
| Wallet rejection/revert/timeout | Failed state is accurate; success is not shown; relevant hash retained |
| Deposit requires approval | Existing exact approval and deposit steps preserved |
| Withdrawal exceeds idle limit | Correct limit/revert behavior; no optimistic fictional cash withdrawal |
| Faucet cooldown | Error presented as failure; no false mint success |
| Borrower dispute | Tied to actual assessment; source/mode and status accurate |
| Reviewer without role | Actual action blocked; selecting workspace does not grant access |
| Uphold dispute | Existing revocation behavior described; no automatic score-increase claim |
| Recovery request/approval | Eligibility, notes, milestone math, pending and approved states preserved |
| Complete milestone | Existing repayment requirement enforced |
| Load failure | Recoverable error or honest unavailable state; no endless unexplained dashes |

### 14.3 Local blockchain integration

Use the existing documented local setup and scripts rather than inventing another transaction test harness:

```powershell
# In frontend, with the required local services already configured:
npm run test:e2e:local
npm run test:browser:local
```

Read `frontend/README.md`, `docs/manual-testing.md`, and `frontend/e2e/onchain-smoke.mjs` for exact prerequisites. The local browser smoke test drives real local-contract operations, uses an injected test wallet, changes local chain time, and writes test evidence. Run it only against an isolated disposable local test chain, never an unknown existing user's chain or Sepolia session.

The local setup uses the existing `contracts` node/deploy scripts and the backend receipt verifier. Set required local values only in the test process/configuration as documented; do not overwrite the owner's environment files. If deployment/export scripts would overwrite tracked generated artifacts, use an isolated test checkout or retain/reconcile only your test-generated changes without disturbing unrelated work. Never regenerate ABIs as a visual-redesign step.

Changing navigation is expected to require test-selector updates. Preserve the test's meaningful assertions about connection, registration, verification, borrowing, repayment, deposits, failure display, demo labeling, mobile behavior, and wrong-network blocking. Do not delete a test because its old button text changed.

If the local stack cannot run, report the precise missing prerequisite and what was actually checked. Continue all other verification; leave integration verification explicitly incomplete rather than declaring success.

### 14.4 Visual evidence

Capture a manageable evidence set under `docs/evidence/frontend-redesign/`, with no secrets or real personal financial data:

1. Desktop landing first screen and one lower content section.
2. Phone landing.
3. New-borrower overview and profile form.
4. Credit profile with contribution explanation.
5. Simulator with edited-but-unsaved inputs.
6. Loan quotation/review with costs and dates visible.
7. Active loan detail and repayment action.
8. Lender position and a deposit/withdraw dialog.
9. Reviewer case detail and recovery-plan preview.
10. A representative dark-mode page, a phone workspace, and an error/pending state.

Use actual rendered UI, not a generated picture. Inspect the screenshots, fix clipping/contrast/alignment problems, and capture again only when needed. Screenshots supplement functional verification; they do not replace it.

## 15. Definition of done and final report

### Design and usability

- [ ] Separate public landing and explanatory pages exist.
- [ ] A dedicated borrower profile page exists with supported create/view/registration states.
- [ ] Borrower credit, simulator, borrowing, loan management, and support have clear destinations.
- [ ] Lender and reviewer workspaces use the same design system but appropriate task layouts.
- [ ] Every navigation item and visible action works or has an explicit supported disabled state.
- [ ] Duplicate actions and inconsistent synonyms are removed where they create confusion.
- [ ] No invented functionality, performance statistics, verification, customer claims, or placeholder financial history.
- [ ] Typography is readable; layouts remain useful at phone/tablet/desktop sizes and in both themes.
- [ ] Empty/error/loading/dirty/pending/confirmed states have been checked.

### Integration

- [ ] All existing user actions are accounted for in the preservation matrix.
- [ ] Backend/contract schemas, configuration, and business rules remain intact.
- [ ] Demo and on-chain data/results are clearly distinguished.
- [ ] Wallet/role/network checks and signing flow remain intact.
- [ ] Exact amounts, approvals, repayment ordering/schedules, recovery math, and receipt semantics are preserved.
- [ ] Confirmed identity and backend verification remain separate where appropriate.
- [ ] Queued loans are not described as funded.
- [ ] No financial state is fabricated after a failed or pending operation.
- [ ] Account/mode changes do not leave stale actionable data.

### Quality

- [ ] Existing frontend checks pass, with any baseline exceptions explicitly documented.
- [ ] Local integration checks pass, or a precise external blocker is recorded without a success claim.
- [ ] Updated browser tests retain their original functional assertions.
- [ ] Keyboard flow, focus visibility, modal behavior, and contrast were checked.
- [ ] Protected files and unrelated user changes were reviewed before completion.
- [ ] Evidence and progress notes reflect what actually happened.

Your final response to the owner should include:

1. The resulting page structure and what became clearer for each persona.
2. Important files changed, grouped by purpose.
3. How existing API and blockchain behavior was preserved.
4. Actual checks run and their results, including blocked checks.
5. Screenshots or a local preview location for the implemented application.
6. Any remaining limitations, stated plainly and specifically.

Do not describe the work as complete if only the public landing is redesigned. Do not hide unsupported features behind polished buttons. Do not claim the backend and blockchain are "unbreakable"; give verification evidence and its limits.

## 16. Copyable execution prompts

### Start prompt

```text
Read docs/ANTIGRAVITY_FRONTEND_REDESIGN_BRIEF.md in full, then implement the complete Credora frontend redesign in this existing repository. Follow the page specifications, design system, integration boundaries, preservation matrix, and implementation phases. Inspect the current working tree and preserve existing user changes. Keep docs/frontend-redesign-progress.md updated with factual progress and test results. Start with baseline checks and integration inventory, then continue through all phases. Deliver working pages and existing connected functionality, not a static mockup or a landing-page-only refresh. Do not modify backend/contracts, invent unsupported features, weaken wallet/role/receipt checks, or publish/deploy. Use the brief's decisions for routine design choices and ask only about a concrete blocker that cannot be resolved safely.
```

### Resume after interruption or context loss

```text
Continue the Credora redesign already in progress. Read docs/ANTIGRAVITY_FRONTEND_REDESIGN_BRIEF.md and docs/frontend-redesign-progress.md, then inspect the actual current diff before editing. Preserve completed work and unrelated user changes. Identify the last completed checkpoint and continue with the next incomplete phase. Do not restart from a template, reintroduce the old tab-only dashboard, or declare success based on previously recorded tests without checking what changed afterward. Keep all existing backend and blockchain behavior protected and finish the remaining pages and verification.
```

### If the implementation looks generic or incomplete

```text
Audit your current implementation against sections 3–11 and 15 of docs/ANTIGRAVITY_FRONTEND_REDESIGN_BRIEF.md. Inspect the actual rendered landing, profile, credit, loan, lender, and reviewer pages at desktop and phone widths. Identify missing page purposes, repeated actions, tiny text, arbitrary cards, unsupported claims, broken navigation, and incomplete states. Correct those issues using the brief's specific layouts and hierarchy. Preserve all existing action handlers and integrations. Do not respond with another proposal; improve the working implementation and verify the changes.
```

### Final independent self-review

```text
Perform a final review of the Credora redesign against the preservation matrix and definition of done in docs/ANTIGRAVITY_FRONTEND_REDESIGN_BRIEF.md. Trace each visible financial or reviewer action to its actual existing API/contract handler. Check exact amounts, mode/account scoping, role/network gates, pending-versus-confirmed status, queued-versus-funded loans, identity synchronization, dispute revocation, and recovery behavior. Run the appropriate checks, inspect responsive screenshots, and fix issues introduced by the redesign. Report actual pass/fail/blocked results and remaining limitations without claiming unperformed verification.
```

---

This brief is based on repository inspection and the prior UI review. Paths, symbols, and available fields must be verified against the current source when implementation begins. The goal is a complete, intentional frontend that communicates Credora's actual purpose while preserving its working system boundaries.
