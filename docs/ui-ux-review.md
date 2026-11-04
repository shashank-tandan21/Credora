# Credora UI/UX review

Reviewed 3 November 2026. This is a design assessment and proposed direction, not an implementation change.

## Scope and project understanding

The README positions Credora as an academic prototype for small, short-term loans to students and early-career researchers with thin credit histories. Borrowers receive an explainable five-factor score; lenders supply a shared pool; borrowers repay installments; reviewers handle disputes and recovery. The distinctive promise is understandable decisions and a path through repayment difficulties.

Inspected the current source and rendered demo screens: landing page, borrower overview, credit simulator, loan eligibility gate, lender overview and deposit dialog, and reviewer queue. Checked light and dark appearance, a 1440px desktop viewport, a 390px phone viewport, and the default approximately 800px panel. The complete loan form and on-chain recovery components were inspected in source. No wallet transactions, reviewer decisions, or real financial actions were performed. This was not a comprehensive accessibility or functional test.

## Overall judgment

The application has a usable component foundation and understandable separation of major responsibilities. Its presentation nevertheless feels assembled from a generic finance dashboard vocabulary. Repeated rounded cards, small supporting text, numerous pills, technical copy, and equal emphasis on unrelated metrics weaken the hierarchy. A palette change alone will not solve this.

Human authorship cannot be determined from appearance. The useful design target is an intentional interface: consistent language, truthful data, deliberate prioritization, and layouts appropriate to the task.

## Priority findings

### 1. Align the interface's claims with the actual prototype

- `frontend/src/utils/cn.ts` aliases `formatUSD` to the INR formatter. Several transaction screens consequently show rupees while the contracts use mUSDC. The landing page explicitly says repayments happen in rupees, and the pool says “Supply More USDC.” Use mUSDC consistently for token quantities. Any INR illustration must be explicitly separate and must not imply a supported currency conversion.
- The landing page's 25,000 liquidity figure and “100% Solvency Ratio” are hardcoded. Label sample figures as examples or derive current figures from the active data source. Do not present a static solvency assertion as measured safety.
- Deposit shortcuts render as `+₹$100`, `+₹$250`, and so on. Their handlers replace the amount, rather than adding to it. Remove the mixed symbols and use amount presets whose labels match their behavior.
- “Current Lending APY” is calculated as 12 multiplied by utilization divided by 100. This is not a demonstrated compounded return. Describe it as an illustrative annualized estimate and distinguish it from realized interest.
- The landing-page methodology supplies financial benchmarks, while the implemented score operates on normalized 0–100 inputs. Verify the provenance of those benchmarks before presenting them as implemented model rules.

These are content and trust problems with visible design consequences, rather than cosmetic issues.

### 2. Give each borrower state an obvious next step

The initial borrower screen shows “Unregistered,” an unassessed score, two zero borrowing-capacity displays, and two prominent “Request Micro-Loan” buttons. Following a borrowing action reaches a screen saying a credit assessment is required. The interface should guide people through prerequisites before advertising the unavailable destination as their next action.

Recommended leading content:

| Borrower state | Main content | Primary action |
| --- | --- | --- |
| No profile | Brief setup checklist | Create profile |
| Profile, no assessment | Evidence/scoring task and what it means | Calculate demo score / submit evidence, according to mode |
| Assessed, no active loan | Eligible amount, cost preview, repayment terms | Review loan options |
| Active loan | Next amount due, due date, remaining balance | Review payment |
| Overdue | Amount overdue and available recovery path | Resolve overdue payment |

Keep restructuring available only when supported by the actual loan state, and explain the approval requirement. Put repayment ahead of acquiring another loan on an active-loan overview.

### 3. Consolidate repeated actions and vocabulary

| Location | Current repetition | Recommendation |
| --- | --- | --- |
| Landing | Header destinations, two hero actions, three workspace cards | Keep persistent navigation and one deliberate entry section; remove redundant workspace promotion |
| Borrower overview | Loan tab plus two “Request Micro-Loan” buttons | Keep navigation; use one contextual primary action |
| Borrower overview | “Borrowing Capacity” and “Available to Borrow” show the same limit | Present the amount once with eligibility context |
| Credit | “Proceed to Borrow” and “Apply for Loan” | Keep one next action after saving/confirming the assessment |
| Pool | “Deposit Liquidity” and “Supply More USDC” | One Deposit action near the user's position |
| Pool | “Withdraw” and “Redeem Capital” | One Withdraw action, using the same wording everywhere |

Repetition is appropriate when a long page needs a second entry point. The issue here is closely grouped competing actions and inconsistent labels. The GOV.UK button guidance also recommends avoiding multiple main calls to action on a page: https://design-system.service.gov.uk/components/button/.

### 4. Simplify navigation and product language

“1. My Facilities / 2. Credit Studio / 3. Request Loan” looks like a sequential onboarding stepper, but the first item is a loan-management overview. Use unnumbered destinations such as Overview, Credit profile, and My loan. Use a separate numbered checklist only during actual setup.

Keep Borrower, Lender, and Reviewer available for an assignment demonstration, but present them as clearly labelled workspaces/personas. Ordinary borrower navigation should not repeatedly ask the user to understand all three roles. Reviewer visibility is a navigation decision; it must not replace real authorization checks.

| Existing copy | Suggested copy |
| --- | --- |
| My Facilities | My loan |
| Commit Assessment | Save demo assessment |
| Requested Principal | Amount to borrow |
| Repayment Tenure | Repayment period |
| Adjudication | Review |
| No Active Borrowing Facility | You have no active loan |
| academic_model=true | Academic prototype |

Retain important technical detail in explanations or transaction details, while presenting the user's task first. Do not label simulated work as a verified or on-chain assessment.

### 5. Make explainability a visible product feature

The credit screen gives most of its space to five sliders and a radar chart. The explanatory notes are less prominent and initially ask the user to commit inputs. A borrower should readily see what the score means and why it has that value.

Use a readable factor breakdown: raw input, weight, earned contribution, and plain-language explanation. A useful row is “Repayment history: 80/100 × 35% = 28 of 35 points.” A bar should encode a named quantity consistently. Keep the simulator for the academic demo, clearly separated from saved and attested scores. The benchmark of 70 should be identified as an illustrative reference unless it has a documented substantive basis.

Move the radar into an optional analytical view if retained. It is less direct than labelled contribution rows for explaining the weighted total. Place a score-dispute link with the saved assessment it concerns.

### 6. Use fewer containers and stronger type hierarchy

The existing Inter font is a sound choice. Changing the font is less important than changing its use. Most descriptions, table text, and standard buttons are 12px, with several labels at 10–11px. Large card padding around tiny text makes the pages feel both spacious and difficult to read.

Recommended starting scale: 15–16px body, 13–14px supporting text, 14px controls, 28–32px page titles, and 36–44px for the one important amount or score. Use regular and medium weights for most text, semibold sparingly. Keep monospace for addresses, transaction hashes, and technical details; use the main font with tabular figures for amounts and dates.

Use one restrained card for the primary task, rows and separators for supporting information, and tables for repayment history and review queues. Use approximately 6–8px button corners, 10–12px panel corners, and a consistent spacing scale. Remove decorative gradients and unnecessary shadows; preserve visible boundaries where they clarify grouping. Icons should aid recognition rather than precede every label.

### 7. Choose one visual identity

Recommended starting direction: warm neutral surfaces, dark ink text, and a deep teal action color. This is an aesthetic proposal, not a claim that teal creates trust or that blue looks AI-generated.

| Purpose | Light palette | Dark palette |
| --- | --- | --- |
| Canvas | #F6F5F1 | #111C19 |
| Surface | #FFFFFF | #1B2823 |
| Main text | #25332F | #EDF3EF |
| Secondary text | #5E6964 | #B4C3BB |
| Main action | #236A5E | #A7D3C5 |
| Text on main action | #FFFFFF | #12261E |
| Dividers | #DADDD7 | #35473E |

Reserve separate status colors for actual warnings, overdue amounts, and confirmations; do not assign unrelated colors to every metric. Keep a visible but quiet Demo/Testnet indicator. The header's phone label “Live” should be replaced by a label that does not suggest real-money operation.

The companion layout illustration uses sample data and shows how an overview changes between a new borrower and someone repaying a loan. It is not a working replacement frontend.

### 8. Fix concrete polish and accessibility defects

- The “How Credora Solves Crypto Under-Collateralization” heading has `dark:white` instead of `dark:text-white`, leaving it almost invisible in dark appearance.
- Landing workspace cards use clickable divs without native keyboard semantics. Use links or buttons according to behavior.
- The modal implements Escape, but lacks dialog semantics, a named close control, focus trapping, and focus restoration.
- Credit sliders have nearby labels but lack programmatic association in the rendered accessibility tree. Give each input a proper accessible name, and make its current value understandable.
- The default approximately 800px header crowds and wraps navigation and pushes the wallet beyond the visible edge. Switch to compact navigation earlier.
- At 390px, borrower cards stack without horizontal overflow, but the large identity and credit cards push the primary borrowing action below the first screen. Prioritize the next task before secondary identity metadata.
- Pool statistics appeared as dashes during inspection without a useful loading/error explanation. Show a clear loading state, then data or a recoverable error; do not let unavailable data look like measured zero.

Verify text contrast, keyboard navigation, visible focus, and mobile touch comfort after redesign. WCAG contrast guidance specifies 4.5:1 for normal text and 3:1 for large text: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum. Suggested larger typography and comfortable controls are design targets, not a claim that small text alone violates WCAG.

## Suggested implementation order

1. Correct units, static claims, mixed-symbol shortcuts, and obvious contrast defects.
2. Establish shared colors, typography, spacing, and button hierarchy.
3. Redesign the borrower overview around actual account/loan states; simplify navigation and labels.
4. Improve score explanations and the loan form. Add exact amount input beside optional sliders; show total repayment, dates, and exact settlement amounts where needed.
5. Consolidate lender actions around the user's position, then improve reviewer case detail and recovery visibility.
6. Rework the landing page to introduce the student need, show one concrete product example, and explain scoring, borrowing, and recovery in plain language.
7. Verify desktop, tablet, phone, light/dark, keyboard use, loading/error states, and demo/on-chain distinctions.

Keep the current application logic and useful shared components where appropriate. The largest gains come from a redesigned presentation and task flow; the visual review does not establish a need to rewrite the backend or contracts.
