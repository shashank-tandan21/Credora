# Credora — UI correction brief, version 2

Prepared 4 November 2026 from the owner's 20 screenshots and the available repository.

## 1. Assignment, evidence, and precedence

Implement a thorough correction of Credora's presentation, navigation, page composition, and state-dependent content in the existing frontend. The owner rejected the previous result because it retained generic dashboard styling, repeated actions, cluttered navigation, excessive technical copy, and repeated academic-prototype branding.

This document replaces the **visual, navigation, page-layout, and visible-copy instructions** in `docs/ANTIGRAVITY_FRONTEND_REDESIGN_BRIEF.md`. Preserve the earlier document's integration constraints and preservation matrix where they concern existing functionality. If a presentation instruction conflicts, this version wins. This is an implementation brief, not a request to generate another plan or a disconnected mockup.

### Evidence boundary

The supplied screenshots show separate borrower pages and a sidebar. The local checkout inspected for this document still has the earlier tab-based `App.tsx`, `components/views`, Inter/JetBrains Mono font imports, and hardcoded slate/blue component styles. Therefore, the screenshot implementation and the inspected checkout are not identical. Do not pretend that the screenshot-specific defects were reproduced in this checkout.

Before changing code, identify the actual working implementation in your environment. Map its routes, components, styles, and action handlers. Use the screenshot observations as the visual audit, and current source as the authority for data and behavior. Do not discard a working implementation or recreate pages merely because a suggested path below does not exist.

Preserve existing uncommitted work. The inspected checkout includes changes to `frontend/src/components/views/LendingPool.tsx` and an untracked `.lender-head.tmp`; their presence is not permission to overwrite or delete them.

### Product understanding

Credora helps students and early-career researchers explore short-term borrowing through explainable credit assessment, a shared lending pool, scheduled repayments, assessment disputes, and structured recovery. Its value should be understandable without knowing Solidity, basis points, or contract names. Borrowers, lenders, and authorized operators have different tasks and should see different tools.

Do not turn this into a generic banking dashboard. Preserve the five-factor assessment, pool participation, loan lifecycle, disputes, and recovery. Do not invent bank connections, verified student credentials, document uploads, profile editing, live exchange rates, guarantees, or operational services that the repository does not provide.

The design decisions below are settled defaults. Execute them without asking the owner to select every color, radius, or navigation label. Continue through all pages and verification. Do not deploy, publish, push, or initiate public-network transactions as part of this work.

## 2. What is wrong with the supplied screens

The problem is not that dark mode or cards are inherently bad. The same treatment has been applied to almost every kind of content, so the user cannot tell what matters. There is also too much uncertainty presented as fact.

| Screenshot file, all dated 2026-11-04 | Observation | Required correction |
| --- | --- | --- |
| `110603.png` | Public header exposes three workspaces, wallet installation, appearance, demo entry, and an academic badge. Hero repeats the badge and entry actions. | Public header has only the wordmark, How it works, and Open app. Remove academic badges and wallet controls. Simplify the hero as specified below. |
| `110707.png` | Three use-case cards followed by four process cards create a wall of similar boxes. | Integrate use cases into one short audience sentence. Use an unboxed ordered process. |
| `110719.png` | Landing page repeats detailed scoring documentation and links visitors directly to reviewer operations. | Move full scoring details to How it works. Remove operator calls to action from marketing sections. |
| `110741.png` | Footer repeats all workspaces and prototype branding. FAQ is mostly about the implementation. | Use a short product footer and purposeful FAQ. Explain operating modes only where relevant. |
| `110750.png`, `110758.png`, `110806.png`, `110812.png` | How it works reads like contract documentation in large nested cards. Currency equivalents and privacy claims need verification. | Use a readable article with headings and a simple table. Move implementation details to developer documentation. Remove unsupported conversions and privacy claims. |
| `110821.png` | Overview contains several routes to the same profile task, empty summary cards, and an academic subtitle. | Render one setup sequence for a new borrower. Show useful financial summaries only when there is data. |
| `110835.png` | Profile form sits in an oversized dashed box, conflates display/legal identity, and shows a wallet address despite an installation prompt. | Use a bounded form, plain labels, and actual connection state. Separate saved profile from blockchain registration. |
| `110847.png` | The page says no assessment exists while also saying an assessment is saved and awaiting attestation. Two buttons open the simulator. | Mutually exclusive credit states; one action per state. Never send a borrower to operator tools as their next step. |
| `110857.png` | Missing profile, zero limit, a 500-token amount, rupee equivalents, and a disabled quote coexist. | Show the first unmet prerequisite before the application form. Use consistent units and valid amount bounds. |
| `110910.png` | Two differently worded loan-application buttons appear in one empty screen. | Empty state owns the only application button. The populated list uses a header action instead. |
| `110925.png` | A disconnected account appears to be in good standing. A large empty panel dominates the page. | Unknown/disconnected is not a positive account status. Place repayment support in the relevant loan detail. |
| `110935.png` | Deposit is repeated. Metrics use unrelated colors. A full bar accompanies 0% utilization. An unexplained approximately 8.4% APY appears. | One transaction area, neutral numbers, accurate bar geometry, and no unsupported yield metric. |
| `111016.png`, `111025.png`, `111032.png`, `111038.png` | Role pill and large warning repeat the same message, even with no connected wallet. | Use connection → network → permission-check → permission-result precedence, with one contextual notice. |
| `111032.png` | Lookup renders a zero-address, zero-value, unknown-status record as a loan. | Validate record existence and render Not found when appropriate. |
| `111059.png` | Demo queue still says Reviewer Role Missing; reason cell is blank. | Demo presentation must not inherit chain permission errors. Map actual reason fields; explain unavailable hashed reasons. |

These observations are not proof of which model wrote the interface. They are specific design and state-handling problems that can be corrected.

## 3. Visual direction: paper, ink, and forest green

Build a calm, readable financial workspace with a modest editorial character on the public site. Use warm neutral surfaces, dark readable text, restrained green actions, and consistent type. The personality comes from proportion, typography, clear language, and well-placed information.

### 3.1 Exact color system

Use semantic CSS variables, shared by every component. The light theme is the default for a new visitor without an explicit saved preference. Respect an existing saved light/dark/system preference. Dark mode is a fully designed counterpart, not the old navy theme left underneath new components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F6F5F0` | `#141B18` | Page background |
| `--surface` | `#FFFFFF` | `#1D2722` | Forms, tables, meaningful grouped content |
| `--surface-subtle` | `#EEEFE9` | `#253229` | Quiet table header or secondary section |
| `--text` | `#202823` | `#EEF1EA` | Body, headings, financial values |
| `--text-muted` | `#59665E` | `#B3BEB5` | Secondary text, helper text |
| `--border` | `#D9DED7` | `#38493E` | Decorative separators and surface outlines |
| `--control-border` | `#7A887D` | `#819387` | Essential input/control boundaries |
| `--brand` | `#245C4F` | `#A9C6B3` | Primary action fill |
| `--on-brand` | `#FFFFFF` | `#142B20` | Text on primary actions |
| `--brand-hover` | `#1A463C` | `#BED4C5` | Primary hover fill |
| `--brand-soft` | `#E6EEE8` | `#2C4033` | Selected navigation background |
| `--link` | `#245C4F` | `#B7D5C1` | Text links, active navigation text, focus accent |
| `--success` | `#2E6144` | `#A9CFAD` | Confirmed positive state text |
| `--success-surface` | `#E8F1E9` | `#223B2A` | Positive status background |
| `--warning` | `#80521D` | `#ECC68A` | Attention-needed state text |
| `--warning-surface` | `#FAF0DE` | `#3B3021` | Attention-needed background |
| `--danger` | `#A43930` | `#F1AEA4` | Failed/destructive state text |
| `--danger-surface` | `#FBEDE9` | `#412925` | Error background |

Usage rules:

- Most of the screen is neutral. Use green to identify actions and selection; do not make every amount green.
- Zero, unavailable, and unknown values are not positive statuses. Show ordinary values in `--text` and unavailable data as an explained dash.
- No blue/purple/green sequence across ordinary metric cards. A metric's position and label explain it.
- Do not put white text on the pale active sidebar fill. Use `--link` on `--brand-soft`.
- Use `--control-border` for boundaries users need to identify an input. The softer divider token is not an accessible control outline by itself.
- Status always has a word or icon plus text; color alone is insufficient.
- Remove decorative gradients, translucent glass panels, glows, rainbow icons, and hover-lift effects from these screens.
- No background image or generated illustration is required. Do not add unrelated imagery to make the layout feel finished.

Computed contrast for the solid token pairs: light body/canvas 13.85:1; light muted/white 6.02:1; light CTA 7.72:1; light active navigation 6.53:1; dark body/surface 13.48:1; dark muted/surface 8.02:1; dark CTA 8.18:1; dark active navigation 7.04:1. These calculations do not certify rendered screens: opacity, overlays, inherited colors, and actual fonts still require inspection. Normal text should meet 4.5:1 and large text 3:1, following [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### 3.2 Typography: use these fonts, not unspecified alternatives

**IBM Plex Sans** is the single font for the complete application: navigation, headings, body copy, forms, tables, buttons, statuses, and amounts. It gives dense financial information a clear, consistent voice. **Source Serif 4** is reserved for the landing-page hero headline. This is a design choice, not a claim that Inter is a bad font or that changing fonts alone fixes the product.

Use the official [IBM Plex](https://github.com/IBM/plex) and [Source Serif](https://github.com/adobe-fonts/source-serif) distributions or verified packages derived from them. Prefer local WOFF2 assets and retain their license notices. Load only the required styles. Use `font-display: swap`. Remove the previous Inter and JetBrains Mono requests once all consumers have migrated.

```css
:root {
  --font-ui: "IBM Plex Sans", "Segoe UI", sans-serif;
  --font-editorial: "Source Serif 4", Georgia, serif;
  --font-code: ui-monospace, SFMono-Regular, Consolas, monospace;
}
body, button, input, select, textarea { font-family: var(--font-ui); }
.landing-headline { font-family: var(--font-editorial); }
.financial-value { font-variant-numeric: lining-nums tabular-nums; }
.technical-id { font-family: var(--font-code); }
```

| Element | Desktop size / line height | Phone size / line height | Weight |
| --- | --- | --- | --- |
| Landing headline | 60 / 64 px | 38 / 42 px | Source Serif 4, 500 |
| Public section heading | 32 / 40 px | 26 / 34 px | Plex Sans, 600 |
| App page title | 30 / 38 px | 26 / 34 px | Plex Sans, 600 |
| App section heading | 20 / 28 px | 20 / 28 px | Plex Sans, 600 |
| Prominent amount | 32 / 40 px | 28 / 36 px | Plex Sans, 500 |
| Body and form input | 16 / 24 px | 16 / 24 px | Plex Sans, 400 |
| Navigation, buttons, table content | 14 / 20 px | 14–16 / 20–24 px | 400 or 500 |
| Helper text and status | 13 / 18 px | 13 / 18 px | 400 or 500 |

Do not use monospace for money, ordinary dates, button labels, process steps, percentages, or paragraphs. Reserve it for wallet addresses, transaction hashes, and technical IDs. Avoid all-capitals labels except genuine abbreviations. Use sentence case. Avoid weights 700–800 across ordinary headings and navigation. Headline letter spacing may be `-0.02em`; body spacing stays normal.

Verify the browser actually loaded the intended faces. Declaring a family without delivering its font files is not completion. Inspect rendered/computed fonts on a title, button, input, and table cell, and confirm there are no failed font requests.

### 3.3 Dimensions and component rules

- Public content width: 1120 px maximum. Article reading column: 680 px maximum. App main content: 1120 px maximum. Operator tables may use up to 1280 px.
- App navigation rail, where needed: 208 px. Header: 64 px. Desktop main padding: 32 px; tablet: 24 px; phone: 16 px.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Page title to first content: 24 px. Related items: 8–16 px. Separate task sections: 32 px.
- Inputs and ordinary buttons: minimum 44 px height. Compact table controls can be 36 px with adequate spacing. Phone targets should generally be 44 px. WCAG 2.2's minimum target criterion is 24 px with exceptions, not a universal 44 px requirement; see [W3C target guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Radius: 6 px for buttons/fields; 10 px for genuine panels; 4 px for small statuses. Fully rounded pills only for items that benefit from that shape, not every button and navigation item.
- Buttons: primary solid brand; secondary outlined; tertiary underlined or clearly styled text; destructive reserved for genuinely destructive decisions. Remove decorative arrows from routine Save, Deposit, and Submit buttons.
- Default panels have a border and no shadow. Menus and dialogs may have one subtle elevation shadow. No scale animation on financial action buttons.
- No decorative dashed panel borders. Keep dashed styling only for an actual supported drop target, which this redesign does not need.
- Each page has one H1. Do not repeat it as the heading of the first enclosing card.
- Do not wrap a page in a card and then wrap its sections and rows in further cards. Use headings, whitespace, and rules. A form can sit on one surface; its fields do not need more panels.
- A simple empty state is approximately 120–180 px high, left aligned in its content area, with one sentence and an action if useful. Do not fill the screen with a centered folder icon and dashed rectangle.
- Forms should fit their content: 560–640 px for profile/attestation, approximately 680 px for assessment. Do not place a 600 px form inside a 1100 px bordered shell with an empty half.
- Use the existing Lucide family with consistent 18–20 px icons and restrained stroke weight. Do not add a colored icon tile to every heading.

### 3.4 Migration must reach the existing components

Adding a token sheet while leaving `bg-blue-600`, `dark:bg-[#111827]`, `text-slate-*`, and large `font-mono` blocks in existing pages will reproduce the current problem.

Inventory the equivalents of `index.css`, `index.html`, `App.tsx`, `App.css`, `ThemeContext`, `Header`, `Button`, `Card`, `Badge`, `Input`, `Modal`, wallet controls, transaction notifications, all views, and any new route components. Map visual utilities to the semantic system. Update the shared components first, then remove overriding page-level colors and type styles. Retain chart/status colors only where they have a documented meaning and acceptable contrast.

Do not solve precedence problems with global `!important` overrides. Do not change exported component behavior or transaction props to achieve a visual change. Audit search results for old blue/slate/indigo/emerald classes and hexadecimal colors; inspect each remaining occurrence rather than deleting mechanically. Check loading, focus, disabled, hover, selection, and both theme states.

## 4. Information architecture and navigation

More pages do not require more permanent menu items. Keep a dedicated profile, assessment, application, and loan-detail experience while showing only the main destinations in navigation.

### 4.1 Public header

The exact desktop header is:

```text
Credora                                      How it works     [Open app]
```

The wordmark links home. Remove Borrower Portal, Lending Pool, Reviewer Desk, Install a wallet, the theme icon, and all prototype badges from the public header. A visitor does not need a wallet to understand the product. On a phone, put How it works in a small menu if needed; keep Open app visible.

Open app opens the existing mode/workspace if a valid preference exists; otherwise open Borrower Overview in Demo mode. Do not add a compulsory role-selection splash screen. In-app workspace selection makes the lender accessible. A quiet Operator access footer link can open the existing operator entry, with actual permission handling there.

### 4.2 Application shell

Use one compact workspace switcher next to the brand, not the large centered three-role segmented control:

```text
Credora   Borrower v                                  Demo v   Account v
```

In on-chain mode, the right side presents the actual network/mode and wallet control. Appearance belongs inside Account/settings, not a separate bright sun button. Do not show the same demo status on both a mode badge and a fake wallet chip. A demo account is not a connected wallet.

The workspace switcher offers Borrower and Lender, with Operator workspace as a separated operational entry. Selecting it changes views only; it never grants roles. Keep demo operator exploration available where already supported. In on-chain mode, use real wallet permissions for actions.

Borrower rail, in this exact order:

```text
Overview
My credit
Loans

[lower utility area]
Profile
Help
```

Remove standalone sidebar entries for Request loan, Score simulator, Disputes & Recovery, and Public Overview. The brand already provides a route home. Never number only one navigation item, as in “3. Request Loan.”

Lender has one primary screen, **Pool**, so do not reserve a full sidebar for one item. Use the same compact top header and a centered content area. Operator workspace uses a rail with **Disputes, Score approvals, Loan operations, Recovery**. Do not rename underlying contract roles or handlers when changing visible labels.

On phones, collapse the rail into a menu with the same order. Close it on navigation, return focus correctly, and make the active destination explicit. Avoid adding a second bottom-navigation system for this assignment.

### 4.3 Pages and their owners

Paths are intended logical destinations. Preserve the current router/hash strategy if it already works. Retain aliases/redirects for old links, browser history, deep links, and refresh behavior. Do not introduce a second router.

| Destination | Menu location / entry | Its responsibility |
| --- | --- | --- |
| `/` | Brand / public entry | Introduce Credora and give one clear route into the app |
| `/how-it-works` | Public header; Help | Explain scoring, borrowing, pool participation, and data boundaries |
| `/borrower/overview` | Overview | Show the next useful task and a brief account summary |
| `/borrower/profile` | Utility: Profile | Create/view profile and show registration/synchronization status |
| `/borrower/credit` | My credit | Current assessment, explanations, validity, and dispute entry |
| `/borrower/credit/simulator` | Contextual action in My credit | Enter normalized factors and calculate an assessment using existing behavior |
| `/borrower/loans` | Loans | List available loan records or one purposeful empty state |
| `/borrower/borrow` | Request a loan within Loans | Prerequisites, amount, duration, quote, confirmation |
| `/borrower/loans/:loanId` | Loan row / overview summary | Payment schedule, repayment, status, and recovery for this loan |
| `/borrower/support` | Help, with contextual deep links | Find existing assessment disputes/recovery requests; preserve legacy links |
| `/lender/overview` | Workspace: Lender | Pool condition, position, deposit, withdrawal |
| `/reviewer/disputes` | Operator: Disputes | Review existing assessment disputes |
| `/reviewer/attestations` | Operator: Score approvals | Publish the existing score attestation |
| `/reviewer/loans` | Operator: Loan operations | Look up loans and expose permitted existing lifecycle actions |
| `/reviewer/recovery` | Operator: Recovery | Review requests and existing milestone plans |

The support route should be a compact index of actual available requests, with tabs if necessary. Start a dispute from its assessment and start repayment help from its loan. Reuse the existing support forms there or deep-link with validated record context. Do not build an imaginary general support ticket system.

### 4.4 Action ownership and duplication

| Action | Canonical home | Allowed contextual shortcut | Remove |
| --- | --- | --- | --- |
| Create profile | Profile form | Single next step on new-user Overview | Extra Manage profile and View identity details buttons in the same summary |
| Calculate assessment | My credit → assessment form | Overview next step when profile is ready | Header and empty-state buttons that both open the same form |
| Request a loan | Loans → application | Overview next step only when eligible and without an active blocking loan | Permanent Request loan menu item and a second button in an empty Loans screen |
| Repay | Specific loan detail | Overview View loan link | Repayment forms duplicated across Overview and Loans |
| Dispute score | Assessment detail | Help links to that assessment | Public Reviewer operations CTA and borrower Reviewer Desk CTA |
| Request repayment help | Eligible loan detail | Help links to that loan | Permanent alarming Recovery tile for every borrower |
| Deposit / withdraw | Lender position transaction area | None on the same page | Header Deposit liquidity duplicate |
| Get test tokens | Wallet menu or funding prerequisite | Inline funding help when balance is insufficient | Permanent equal-weight header action on every page |

A navigation link and a relevant action can coexist; the goal is to remove competing task buttons, not make features undiscoverable. Use at most one visually dominant primary action per current task state. On a populated list, the header may own creation; in its empty state, the body owns it instead. A contextual modal may have its own primary confirmation button.

## 5. Exact page compositions

### 5.1 Landing page

Use these sections in order, with roughly 64–80 px between major sections on desktop and 40–48 px on phones. Do not add another feature-card grid or a wall of metrics.

**A. Header and hero.** Two columns, approximately 60/40, text first. No enclosing hero card. Use the Source Serif 4 headline, entirely in the ink color:

> Small loans. A clearer way forward.

Supporting copy:

> Understand your credit assessment, review your borrowing terms, and keep track of every repayment. Built around the short-term funding needs of students and researchers.

Below it, a quiet text link “See the borrowing steps” scrolls to section B. The persistent header's Open app button is the primary entry in this viewport; do not add Explore demo, Explore borrower demo, Open borrower workspace, and a lender link beside it.

On the right, show one restrained example quotation sheet: a small “Example” caption, requested amount, duration/rate, and total repayment. Use the existing validated quote formatter/helper or an existing checked demo fixture. Mark it as an example once. Do not call it a certified limit, show a fake transaction, or attach a rupee equivalent. If the calculation source is unavailable, show a static preview of the quotation's labeled fields without made-up figures. It is a preview, not an interactive form.

Use a plain surface with one hairline border and a total row separated by a rule. No inner colored cards, gradient, floating badges, giant shield, or decorative mock browser. The preview should be visually quieter than the headline.

**B. How borrowing works.** Four short unboxed steps: Create your profile; Understand your assessment; Review the terms; Track repayments. One sentence per step, at most about 20 words. Use an ordered list with a fine rule, not four padded cards. Collapse vertically on phones.

**C. Why the assessment is understandable.** One balanced text-and-detail section. Explain that five factors contribute to the score and the borrower can inspect the breakdown and challenge an assessment. Link to the detailed explanation. Do not repeat the full factor table or favorable thresholds here. Mention the shared pool in a short adjacent paragraph, without another Borrow/Lend/Reviewer button group.

**D. Questions and footer.** Three or four plain accordion questions: Do I need a wallet to explore? How is the assessment calculated? How do repayments work? How does the lending pool work? Answers link to relevant sections instead of copying them. Explain Demo/Testnet in the wallet answer without academic-prototype branding. Do not promise approvals, guaranteed returns, real funds, or instant funding regardless of liquidity.

Footer: Credora wordmark, a short product description, How it works, and quiet Operator access. Remove prototype badges, version labels, and the repeated complete workspace menu. No additional CTA band is needed while Open app stays accessible in the header.

### 5.2 How it works

This is user help, not the README. Use an unboxed article of approximately 600–800 words, a 680 px reading column, and a small on-page contents list on desktop. Main sections: Your assessment; Borrowing and repayment; The lending pool; Your information and reviews.

- Explain each of the five factor names and verified weights in one simple table. Current documented weights are 35%, 25%, 15%, 15%, and 10%; check the current implementation before publishing them.
- Do not invent thresholds for real income, debt-to-income ratios, or evidence verification when inputs are normalized scores. The screenshot's favorable-threshold column should be removed unless its rules are actually implemented.
- Explain that a calculated assessment and an approved on-chain score are separate states. State that an authorized operator publishes the latter.
- Explain amount, interest, total repayment, due dates, and what happens when funding is queued. Display current rates from their source; no guaranteed funding language.
- Explain pool shares and liquidity-constrained withdrawals in ordinary language. Do not claim a fixed lender yield.
- Describe public blockchain fields and off-chain information only as supported by code. Do not claim the identity hash proves a legal name, or that bank statements are collected, encrypted, verified, or uploaded if those capabilities do not exist.
- Explain assessment disputes and eligible repayment restructuring. Keep contract names, bytes32 padding, UUID encoding, and raw role constants in developer documentation or an optional technical-details disclosure where actually useful.

Remove the Academic Protocol Documentation eyebrow, repeated numbered containers, and the separate giant warning inside the pool explanation. A clear sentence beside withdrawal information is enough.

### 5.3 Borrower Overview

Title: **Overview**. A short greeting may use the actual saved display name, never a fabricated persona. The page composition changes with account state.

**No profile:** Show a single “Set up your account” section with three rows: Profile; Credit assessment; Loan terms. The first incomplete step owns the primary button. Later steps show simple explanatory text. Do not render credit limit 0, identity unregistered, backend pending, and an attestation warning in separate panels.

**Profile ready, no assessment:** Show “Your next step: understand your credit” with one Calculate assessment action. Below, one compact row confirms the existing profile. No second profile-management card.

**Assessed, awaiting chain approval:** Explain that the calculated assessment exists but borrowing is not yet available in this mode. Link to My credit for detail. Do not manufacture a Request approval action if no endpoint exists, and do not route the borrower to the operator console.

**Eligible, no active loan:** Show the eligible amount, current assessment status, and one Request a loan action. A compact link can open the full score breakdown. No second borrowing form here.

**Active loan:** Make the next payment amount and due date the strongest information. Use View loan as the action so repayment has one canonical home. Below, show remaining balance and a short credit summary. Only show activity from available records; do not invent a timeline or chart.

**Overdue:** Show the actual past-due amount and due date, with View loan. Do not combine a green good-standing message with an overdue or unknown state.

### 5.4 Profile

Title: **Profile**. Use a single 600 px form column. No oversized dashed card or repeated Create your borrower profile heading.

Fields: **Display name** and **About you (optional)**. Suggested placeholders: “Your name” and “A short introduction.” Remove “Legal name,” “Academic background,” PhD examples, and claims of identity verification unless a real supported process requires them. Keep actual validation: currently name 2–100 characters and bio up to 500; verify current schema.

The save action must use the existing profile handler. Where profile persistence and blockchain registration are separate operations, present separate progress states: Profile saved; Registration needed/pending/confirmed; Connection to the service needs retry. A confirmed registration followed by a synchronization failure must offer the existing safe retry, not create another registration transaction.

Show wallet details in a short read-only row only when actually connected in on-chain mode. Do not call a seeded demo address the active wallet. If a profile is saved but editing is unsupported, show a readable profile view, not a working-looking Save changes button backed by the create endpoint.

Put extended IDs, hash, registration receipt, and synchronization diagnostics behind “Technical details.” Keep the action's relevant consequence visible before confirmation.

### 5.5 My credit

Title: **My credit**. This page owns explanation, status, and assessment-specific actions.

**No assessment:** One short section: “You haven't calculated an assessment yet.” Primary action: Calculate assessment, provided its prerequisites are satisfied. Hide empty score/limit/status metric cards and all “assessment is saved” text.

**Assessment exists:** Use a large score such as `78 / 100` only from data, one plain-language status, and a separate borrowing eligibility value if the mode supports it. Below, use a full-width factor table: Factor; Your result; Weight; Contribution. Explain major influences in short sentences from available evidence. Do not replace meaningful explanations with a circular gauge.

**On-chain approval pending/missing:** Say “Calculated assessment available. An authorized operator must approve it before on-chain borrowing.” Only show this when the assessment really exists. Do not show a borrower-facing Reviewer Desk button.

**Expired/revoked:** Name the exact state and reason if available. Do not keep labeling the limit certified/available after validity ends. A recalculation does not itself restore chain authorization.

Place Recalculate assessment as a secondary action when a result exists. Place Dispute this assessment beside the current result, with identity/ownership/validity rules preserved. Assessment history is a table or disclosure below, not another navigation destination. Match off-chain assessment IDs to on-chain attestations; do not assume any saved score is the attested score.

### 5.6 Assessment form

Keep a distinct form page under My credit, with a back link. Call it **Calculate your assessment** if that is what the current operation does. Explain when inputs are normalized factor scores; do not disguise manually entered scores as verified bank evidence.

Use labeled numeric fields with optional synchronized sliders, grouped by the five existing factors. Show units and allowed ranges. One short explanation per field is enough. Use one calculation/save action matching existing behavior, then route to the result. If the existing simulator previews before saving, clearly separate Preview from Save assessment and preserve that distinction.

Do not add fake file uploads or a Save draft promise without persistence. Preserve typed values through recoverable request errors. Do not show a valid saved score before the operation actually succeeds.

### 5.7 Loans and application

**Loans list:** Title Loans. With no loans after a successful scoped read, show “No loans yet” and one Request a loan button. Remove the header creation button in that state. With records, use a table/list of amount, status, next due date, remaining amount, and View loan; creation moves to the header if permitted. Scope history to what is actually available. The current chain hook may expose only an open loan: label that coverage, rather than inventing settled-loan history.

**Application:** Title Request a loan. Start with prerequisite resolution. If no profile exists, show the profile step and its action. If no valid assessment exists, show the credit step. If the wallet/network is not ready for an on-chain action, show that prerequisite. Do not render an apparently usable 500-token form with a zero limit behind a large warning.

When eligible, use a 60/40 desktop split: amount/duration on the left; one quote summary on the right. On phones, stack inputs first, quote second, confirmation last. Show an editable amount field with mUSDC unit and actual min/max; slider is supplemental, not the only input. Derive all bounds and durations from current supported rules.

Quote summary: Principal; Interest rate; Total interest; Total repayment; First payment date when known. Put the verified schedule immediately below or in an accessible disclosure. Do not repeat the APR in a title badge, intro, terms box, and summary. Put concise terms beside the final confirmation; keep the full exact obligations accessible before signing.

Use mUSDC consistently for token amounts. Remove unsupported rupee/dollar equivalents from all views and examples. A helper named `formatUSD` is not evidence of USD or INR value. If a future verified currency display is introduced, it needs a real source and explicit rate context; that is outside this redesign.

Disable submission for invalid or stale quotes and explain the reason beside the action. Preserve units, precision, receipt handling, and queued-versus-funded results. Do not describe a queued request as money received.

### 5.8 Loan detail and repayment help

Title **Loan [existing display identifier]**, with status next to it. Top: next payment and due date; primary Pay installment when available. Secondary Pay in full appears nearby, with a review step. Show balance, original amount, interest, and total paid as plain aligned rows. Follow with the payment schedule table and actual transaction history/receipts when available.

Do not show every contract action as an equal button. Cancellation, overdue recording, or other exceptional operations belong in context or a More actions menu and retain their actual gates.

Show **Need help with repayment?** near the schedule when appropriate. If restructuring is eligible, the existing form opens with this loan preselected. If a request or plan already exists, show its status and milestone schedule. Preserve duplicate-request prevention. Do not claim a request is approved, a milestone paid, or a debt forgiven from a local UI change.

Avoid a permanent large Recovery panel for users with no relevant loan. Never say “Your account is in good standing” until account-scoped data has loaded and supports it.

### 5.9 Lender Pool

Title **Lending pool**, with one short explanation. No sidebar containing only Lending pool and documentation.

Top: a horizontal summary strip of Total pool assets, Available liquidity, and Utilization, separated by rules rather than four floating cards. Values use normal ink. Drop the screenshot's approximately 8.4% APY unless a valid implemented source and definition can be demonstrated. Borrower APR is not lender APY. If no reliable lender-yield calculation exists, omit the metric entirely.

Main content: Your position on the left; Pool allocation on the right. The position shows actual current value, shares, and withdrawable amount. For a disconnected wallet, show Connect wallet to view your position; do not show made-up zero balances. Demo data remains visibly scoped to Demo mode.

One transaction area beneath the position owns **Deposit** and **Withdraw** as tabs or a primary/secondary pair. Do not duplicate Deposit in the page title. The form uses actual balance, allowance, liquidity limits, and transaction review. Get test tokens is funding assistance or a wallet-menu action, not a competing major CTA.

For allocation, use a correctly labeled deployed/available bar and values. If showing utilization, fill equals utilization: 0% has no deployed fill and 100% is full. If using a stacked allocation bar, name both segments so a fully available pool is not mistaken for full utilization. Remove decorative progress bars without mathematical meaning.

Put “How pool shares work” behind a short disclosure. State that withdrawals depend on available liquidity and that losses can reduce position value. Do not describe defaults as rare or returns as steadily increasing without supporting evidence. Do not infer personal profit from a pool-wide interest total.

### 5.10 Operator pages

These are operational tools with compact tables and focused forms, not marketing panels. Use the same fonts and colors, slightly denser layouts, and no giant empty-state cards.

**Shared access presentation:** Resolve mode, configuration, wallet, network, role-loading, and role-result before showing restrictions. Show exactly one contextual message. Examples: “Connect a wallet to use operator actions”; “Switch to the configured network”; “Checking permissions”; “Read-only access — approving scores requires an authorized wallet.” Do not show Role Missing pills plus Role Restriction banners. Never display `ATTESTER_ROLE` or `RECOVERY_OFFICER_ROLE` as required reading in ordinary copy; exact constants can appear in technical details. Preserve server/contract checks regardless of hidden controls.

**Disputes:** One table with Case, Assessment, Submitted when available, Status, Reason, and Review. Filters only operate on actually available records. In the recent-window chain queue, say “Recent cases” and explain coverage; do not claim a complete historical count. Use a detail panel/dialog for evidence and decision. When only a reason hash is available, show “Reason text unavailable” with technical detail, not a blank cell or fabricated decoded text. Separate demo queue permissions from on-chain roles. Confirm the actual consequence of an upheld dispute, including score revocation where implemented.

**Score approvals:** Page title matches navigation. Form width approximately 600 px. Select an existing assessment if supported; otherwise retain required ID/address/score/validity fields with concise guidance. Do not insert a random UUID or imply it references reviewed evidence. Review the target wallet, assessment, score, and validity before the existing attestation transaction. Remove bytes32 encoding instructions from normal field help.

**Loan operations:** Provide an explicit ID lookup/search action. No successful-looking record before a completed read. Validate the returned struct's existence using contract semantics, including zero-address/default status handling. Render Not found, Loading, and Request failed separately. Show funding/default/overdue actions only for appropriate records and roles, preserving existing rules.

**Recovery:** Requests in a table/list, details with loan context and submitted proposal, existing approve/reject/milestone actions in context. Distinguish no cases after a successful read from an unavailable queue. Do not expose actionable controls to unauthorized wallets or change permission checks to make a demo screenshot look populated.

## 6. State correctness is part of the redesign

Use explicit state derivation or a small presentation adapter around existing hooks. Do not copy complex conditions into every page. A single generic “empty” branch is insufficient.

| Situation | Required display | Must not display |
| --- | --- | --- |
| Demo mode | One compact Demo indicator; simulated result wording | Missing chain role, real transaction receipt, fake connected wallet |
| Chain configuration missing | Configuration unavailable and recovery guidance | 0 balance / no cases as if queried successfully |
| Wallet disconnected | Connect/install prerequisite for personal actions | “Your wallet lacks the role,” good standing, personal zero balances |
| Wrong network | Network switch prerequisite | A permission verdict based on the wrong network |
| Data or roles loading | Scoped loading state | Missing role or no records before the read completes |
| Fetch failed | Failure message and Retry where safe | Silent fallback to demonstration data or success empty state |
| Successful read, no record | A concise empty state with the relevant next action | A zero-address record or synthetic summary metrics |
| Assessment exists but not approved | Calculated result plus pending/missing approval explanation | “No assessment” and “saved assessment” together |
| No role after a successful check | Read-only explanation near unavailable actions | Duplicated page badge plus full-width warning |
| Transaction submitted/pending | Actual progress with receipt/hash when available | Confirmed, paid, funded, approved, or updated prematurely |
| Transaction failed/rejected | Clear result, preserved inputs, safe retry | Fake optimistic success or duplicate automatic submission |

Order applies per affected operation, not as a global wall that hides public data. A disconnected lender may still see public pool totals if the client can read them, while the personal position remains unavailable. Read-only records can remain visible where actually supported. Demo fallback is allowed only within established Demo-mode behavior.

On account, chain, or mode changes, clear stale personal presentation and refetch under the new identity. Keep existing scoping/invalidation/remount behavior. Do not let a previous wallet's loan, a demo balance, or a pending transaction become another account's result.

## 7. Copy cleanup, including academic labels

Remove the following from ordinary rendered UI: Academic Prototype; Academic Research Prototype; Non-commercial Research Prototype; Academic Micro-Lending Portal; Academic Protocol Documentation; v1.0-research; repetitive “prototype” descriptions. Remove them from public and app headers, hero badges, footers, page subtitles, and profile prompts. Update metadata/title if it repeats that positioning.

This instruction does **not** remove the actual audience. “For students and researchers” remains useful. It also does not require deleting the README's project context or misrepresenting the mode.

Keep mode information compact and factual:

- One in-app indicator: Demo, Local test network, or Sepolia test network, based on actual state.
- Mode help: “Demo actions are simulated. Test-network actions use test mUSDC, which has no monetary value.” Put this in mode help/onboarding and relevant transaction review, not repeated across every page.
- Demo confirmation: “Simulate deposit” or an equally clear simulated confirmation. On-chain confirmation: the actual action, network, amount, and existing wallet sequence.
- No new claims such as regulated, insured, bank-grade, legally verified, audited, guaranteed approval, or guaranteed yield.

| Replace | With / rule |
| --- | --- |
| Borrower Portal / Borrower Workspace in every title | Borrower only in workspace switcher; page titles name their tasks |
| My Borrower Profile | Profile |
| Credit Assessment Profile | My credit |
| My Loan Facilities | Loans |
| Full Repayment Obligation | Total repayment |
| Quotation summary | Loan summary |
| Lending Pool & Liquidity Desk | Lending pool |
| Capital Deployment & Health | Pool allocation |
| On-chain Operations when approving scores | Score approvals |
| Restructuring petitions | Repayment support requests |
| No Active On-chain Loan | No loans yet, only after a successful account-scoped read |
| Profile Required warning | Create your profile to continue, with one action |

Prefer one short subtitle only when it adds information beyond the title. Most headings need no icon. Do not make all copy sound like contract documentation. Hide implementation details with progressive disclosure, while keeping amounts, interest, dates, restrictions, and transaction consequences visible when users decide.

## 8. Backend and blockchain preservation boundaries

Keep this a frontend correction. Changes to layout, copy, navigation, shared styles, presentation state, and carefully justified frontend adapters are in scope. Rewriting financial logic, backend routes, database schemas, Solidity, deployments, ABIs, chain IDs, role definitions, or generated deployment files is not.

Before moving a feature, record its existing data source, handler, input validation, and resulting state. These source locations were present in the inspected checkout; verify equivalents in yours:

- `frontend/src/api/client.ts`: profile, evidence, assessment, quotes, loans, demo pool and dispute operations, and `syncIdentity`.
- `frontend/src/web3/hooks.ts`: borrower, pool, role, queue, and lookup reads.
- `frontend/src/web3/actions.ts`, `transactions.ts`, `useContractTransaction.ts`: existing prepared steps, approvals, wallet requests, receipts, errors, and invalidation.
- `frontend/src/web3/units.ts`: exact token units and precision.
- `frontend/src/contexts/AuthContext.tsx` and `Web3Provider.tsx`: mode/account/network behavior.
- Existing borrower, lender, reviewer, operations, wallet, transaction, and loan components: all reachable operations must survive relocation.

Preserve these invariants:

1. Existing API payload keys, IDs, response interpretation, validation, and contract arguments remain compatible. Changing a field's visible label does not change its payload meaning.
2. Keep test-token units and bigint settlement. Never feed a rounded display number back into a transaction. Do not change calculations to match a tidier UI.
3. Preserve the exact quote source, duration rules, installment count, final remainder, eligibility, repayment, default, and recovery rules. The actual schedule wins over generic “monthly” copy.
4. Preserve token allowance/approval steps, transaction simulation, wallet signature, pending receipt, confirmed receipt, rejection/revert handling, and query refresh.
5. A successful saved profile, registered identity, backend synchronization, calculated assessment, and attested score are distinct outcomes.
6. Preserve queued-versus-funded loan outcomes from the existing events; a successful request can still require funding.
7. UI workspace selection never grants a blockchain role. Disabled/hidden controls do not replace authorization.
8. Keep dispute/recovery reason text off-chain under the existing scheme. Do not change hashes, UUID encodings, or infer legal identity from an opaque ID hash.
9. Preserve recovery eligibility, duplicate prevention, plan validation, and requirements for marking a milestone complete. Preserve the actual outcome of dispute resolution.
10. Do not create a fake profile-edit endpoint, loan-history indexer, upload service, notification center, or new support service as part of polishing the interface.

If a real integration defect prevents correct presentation, fix it only within authorized frontend scope where possible and verify it. If backend/contract work is genuinely necessary, document the exact issue and leave affected UI honest; do not silently rewrite the backend to make screenshots pass.

## 9. Implementation sequence and measurable checkpoints

Maintain `docs/ui-refinement-v2-progress.md`. Record the actual implementation version, route map, preserved handlers, existing unrelated changes, decisions, check results, and remaining issues. Mark earlier redesign progress as historical rather than assuming its completion means this revision is done.

### Phase 1 — Map and remove

1. Identify the implementation matching the screenshots or document the mismatch.
2. Inventory all routes, entry points, repeated CTAs, styles, and data states.
3. Record a baseline for the available frontend checks and existing integration tests.
4. Write a short old → new route/component map in the progress file.
5. Remove redundant public navigation and academic branding; consolidate action ownership and restore functional links before styling individual pages.

Checkpoint: public header matches the three-item composition; main borrower navigation has three primary destinations plus Profile/Help utilities; old deep links still land somewhere useful; every existing operation has an identified new home.

### Phase 2 — Build the shared visual foundation

Implement fonts, theme tokens, shell, typography, buttons, inputs, statuses, tables, empty states, wallet controls, and transaction feedback. Update all conflicting hardcoded page styles as they migrate. Make two real reference screens first: the landing page and My credit in a populated demo state. Also inspect My credit with no assessment.

Checkpoint: capture and inspect both themes at desktop and phone widths. Confirm loaded fonts, actual token colors, readable active navigation, no nested panel stacks, and mutually exclusive credit states. Revise until these meet this document, then continue. This is an internal verification checkpoint, not a mandatory permission pause.

### Phase 3 — Complete borrower journeys

Implement Overview, Profile, assessment form/result, Loans, application, detail/repayment, disputes, and support/recovery. Use real demo scenarios or existing fixtures isolated to Demo mode to exercise populated states. Do not put sample values into live empty states.

Checkpoint: a user can create a supported profile, calculate an assessment, understand eligibility, review a valid quote, request a loan, inspect the correct result, and reach available repayment/dispute/recovery actions without broken navigation or duplicate transaction forms.

### Phase 4 — Complete lender and operator journeys

Implement the Pool composition, transaction area, accurate allocation, permission states, dispute queue/detail, score approvals, loan lookup/actions, recovery queue/plans. Check all role combinations relevant to the existing handlers.

Checkpoint: no unsupported APY, no full utilization bar at 0%, no synthetic personal balances, no Missing Role state in Demo mode, no default zero-address loan card, and no blank unexplained reason column.

### Phase 5 — Verify behavior and rendered quality

Run the current equivalents of these frontend checks from `frontend`:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Use existing `test:e2e:local` and `test:browser:local` only with their required disposable local services. They may mutate local chain state and time. Do not point them at a public network. Keep existing behavioral assertions; adjust navigation selectors only where the redesign requires it. Add focused tests only for meaningful changed state derivation/formatting or repaired regressions, not tests that merely repeat CSS implementation details.

Inspect actual rendered pages at approximately 1440 px, 1024 px, 768 px, and 390 px. Also check long addresses, long names, 200% zoom, keyboard navigation, missing wallet, loading, errors, empty/populated states, and both themes. Ensure tables either adapt appropriately or have a contained accessible horizontal scroll; the page itself should not overflow. A quote sidebar becomes normal flow on small screens and must not cover the submit action.

For dialogs: meaningful title, keyboard focus contained while open, Escape behavior where appropriate, focus returned to the trigger, labeled controls, and no lost entered values on a recoverable error. For transaction status: announce meaningful updates without repeatedly announcing every render. A submitted transaction must remain visible when navigating away from its form.

Save representative screenshots under `docs/evidence/ui-refinement-v2/` and a concise coverage table in the progress file. Use at least: landing desktop/phone, Overview setup/active, Profile, My credit empty/populated/approval pending, application gated/ready, Loans empty/detail, lender disconnected/populated, and operator unauthorized/authorized/empty cases. Do not claim screenshots cover states that were not exercised. If an environment prevents a check, record it as blocked and explain the exact limit.

### Visual acceptance checklist

- [ ] A new visitor sees only Credora, How it works, and Open app in the public header.
- [ ] Public screens contain no wallet-installation prompt or operator task buttons.
- [ ] No repeated academic-prototype branding remains in rendered UI.
- [ ] Demo/Testnet meaning remains accurate and easy to find without repeated banners.
- [ ] IBM Plex Sans actually renders across the app; Source Serif 4 renders only the landing headline.
- [ ] Light and dark use the new neutral/forest tokens throughout, including dialogs and transaction status.
- [ ] Amounts use tabular figures in the UI font; monospace is restricted to technical identifiers.
- [ ] Main borrower navigation is Overview, My credit, Loans; Profile/Help are utilities.
- [ ] Each task state has one dominant action; empty states do not repeat a header CTA.
- [ ] No page relies on card-inside-card-inside-card framing or decorative dashed empty panels.
- [ ] Landing content and How it works have distinct purposes and do not repeat the full factor table.
- [ ] No “no assessment” and “assessment saved” contradiction, or green good-standing message from unavailable data.
- [ ] No invented APY, currency equivalent, full utilization fill at 0%, or fake personal balance.
- [ ] No missing-role verdict before wallet/network/permissions are actually resolved.
- [ ] Every previously working operation remains reachable and connected to its real existing handler.
- [ ] Tests and visual evidence are reported honestly; a successful build alone is not design acceptance.

The final implementation report should state what was consolidated, the resulting navigation, the actual palette/fonts used, which integration checks passed or were blocked, and where to inspect the real screenshots. Do not call the app finished while only the landing page is redesigned.

## 10. Copyable prompts

### Start or correct the current implementation

```text
Read docs/ANTIGRAVITY_UI_REFINEMENT_V2.md fully and implement it in the existing Credora frontend. It supersedes the old brief's UI, navigation, layouts, and visible copy; preserve all backend/blockchain integration constraints. First identify the actual implementation matching the supplied screenshots and preserve existing uncommitted work. Apply the exact warm-neutral/forest palette, IBM Plex Sans app typography, Source Serif 4 landing headline, simpler public header, reduced borrower navigation, action ownership, page compositions, and explicit state rules. Remove repeated academic-prototype labels, duplicate buttons, nested-card clutter, and unsupported financial claims. Preserve concise truthful Demo/Testnet context. Keep docs/ui-refinement-v2-progress.md updated. Work through all phases, inspect rendered screenshots in both themes and on phones, run appropriate checks, and fix issues before reporting completion. Do not stop at a new plan, a token stylesheet, or a redesigned landing page. Do not rewrite backend/contracts, fake data to hide empty states, weaken permissions/receipt handling, or deploy/publish.
```

### Resume after interruption

```text
Continue the Credora UI correction from docs/ANTIGRAVITY_UI_REFINEMENT_V2.md. Read docs/ui-refinement-v2-progress.md and inspect the current diff before editing. Preserve completed work and unrelated changes. Resume the next incomplete phase; do not restart the project or revert to the previous brief's navigation/copy. Verify the actual rendered design, data states, and existing connected operations. Record fresh results for checks affected by subsequent changes and finish the remaining acceptance items.
```

### Final critique before handoff

```text
Review the implemented Credora UI against the screenshot defect table and acceptance checklist in docs/ANTIGRAVITY_UI_REFINEMENT_V2.md. Inspect rendered pages, not just source. Check font loading, token consistency, public navigation, CTA ownership, nested containers, useful empty states, account/mode/permission state precedence, currency units, loan quote accuracy, and transaction outcomes. Trace every financial/operator action to its preserved handler. Correct the remaining defects and report actual visual and functional verification, including anything blocked. Do not certify success from a build result alone.
```
