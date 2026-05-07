# Project Status: DCF Analysis Tool (DCF by Kong)

## 🚀 Current State
A professional-grade, fully deployed web application for Discounted Cash Flow (DCF) analysis. The tool integrates real-time stock data, historical financial analysis, and AI-driven research. Now fully optimized as a Progressive Web App (PWA) with advanced 3-stage valuation logic and technical/fundamental insights.

### 🏗️ Technical Architecture
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Lucide Icons, Recharts.
- **Backend:** Next.js Route Handlers, `yahoo-finance2` (Deep Scraper).
- **Database/Auth:** Supabase (Auth OTP + Postgres Database).
- **AI Layer:** Google Gemini AI (`gemini-3.1-flash-lite`).
- **Deployment:** Vercel (Production Ready).
- **Mobile:** PWA (Progressive Web App) with standalone window support.

### ✅ Completed Milestones
1.  **Advanced DCF Engine:**
    - **3-Stage Growth Model:** Initial High Growth, Linear Transition (Step-down), and Terminal Perpetuity phases.
    - **Net Debt Adjustment:** Enterprise Value to Equity Value bridge (EV + Cash - Debt).
    - Real-time sliders for WACC, 3-Stage Growth, and Time Horizons.
2.  **Financial Ratio Analysis:**
    - **Fundamental Ratios:** Added a dedicated section for ROE, ROA, Debt/Equity, Current Ratio, and Operating Margin.
    - Real-time extraction from Yahoo Finance with fallback logic.
3.  **Technical Indicators:**
    - **Price Chart Enhancements:** Added a 12-Month Moving Average (MA12) overlay to the 5Y price chart.
    - **RSI(14):** Integrated Relative Strength Index calculation with Overbought (>70) and Oversold (<30) visual indicators.
4.  **Data Visualization:**
    - **Enhanced FCF Chart:** Color-coded visualization showing History, Initial Projection, and Transition phases.
    - **3-Stage Summary Table:** Clear breakdown of growth rates and durations for each stage.
5.  **Progressive Web App (PWA):**
    - Fully installable on iOS, Android, and Desktop.
    - Custom standalone window mode (no browser address bar).
    - **OTP Authentication:** Hardened OTP flow specifically for standalone installation sandboxes.
6.  **Gemini AI Integration:**
    - **AI Research Assistant:** Automatically researches and suggests DCF parameters.
    - **Research Indicator:** (CRITICAL) Restored and hardened the "Gemini is Researching" visual feedback system.

### ⚠️ CRITICAL MANDATES (DO NOT REMOVE)
- **AI FEEDBACK UI:** Never remove or disable the "Gemini is Researching" or "AI Assistant" loading indicators in the DCF tool. These MUST remain visible whenever `aiLoading` is true to provide visual feedback during background AI analysis.
- **SECURITY:** Always ensure Row Level Security (RLS) is enabled on Supabase tables (specifically `public.analyses`).
- **PWA:** Maintain standalone window support for iOS/Android installations.

7.  **Bug Fixes & Hardening (April 2026):**
    - **DCF Input Validation:** Added guards for WACC <= Terminal Growth (division by zero) and zero shares outstanding. Returns structured error with UI warning banner.
    - **AI JSON Parsing:** Replaced greedy regex with balanced-brace extractor that tries markdown code fences first, preventing mis-parsed AI responses.
    - **Performance:** Memoized SensitivityTable (React.memo + useMemo for 25-cell DCF grid). Fixed StockPriceChart data mutation (deep copy instead of mutating parent state).
    - **Auth Leak Fix:** Fixed Supabase auth listener memory leak (missing unsubscribe on cleanup).
    - **Turbopack Compat:** Added empty `turbopack: {}` config to silence Next.js 16 warning from PWA webpack plugin.
    - **Supabase Init:** Cleaned up client initialization with proper `isSupabaseConfigured` gating.

8.  **Code Review Hardening (2026-04-23):**
    - **Supabase defense-in-depth:** Added `.eq("user_id", user.id)` to `fetchSavedAnalyses` and `deleteAnalysis` so RLS is not the sole access boundary.
    - **Chat UX:** `handleGeminiChat` restructured with explicit early returns — `peers`, `resolve-ticker`, `all-in-one`, `research`, and `combined` no longer leak raw JSON blobs into the chat panel.
    - **AI param application:** Extracted `applyDcfParams(params)` using `typeof === "number"` checks instead of truthy — valid `0` values (e.g. `transitionYears: 0`) are now respected.
    - **DCF recompute:** Dropped the `fcf !== 0` gate; negative/zero FCF now computes so loss-makers render a meaningful intrinsic value.
    - **PDF pagination:** `downloadPDF` now slices the rendered PNG across A4 pages via negative-Y `addImage` offsets — tall reports no longer clip.
    - **Race guards:** `AbortController` refs on `fetchStockData` and `handleGeminiChat` cancel in-flight requests on new ticker/chat submissions.
    - **Prompt sanitation:** `/api/chat` strips `\n\r{}\`` and caps ticker/context length before interpolating into prompts.
    - **Ticker aliases:** Removed the Geely hardcode from the resolve prompt; moved to a `TICKER_ALIASES` table checked before the AI call.
    - **Observability:** `/api/stocks` now returns `{ peers, failed }` so the client logs which peers couldn't be fetched. Debug payload in `/api/stock` is gated behind `NODE_ENV !== 'production'`.
    - **History hygiene:** Chat history is only forwarded when `type === "chat"` — eliminates linear token growth from JSON responses being re-uploaded.
    - **Auth consolidation:** New `src/lib/auth-context.tsx` (`AuthProvider` + `useAuth`) replaces duplicated `getUser` + `onAuthStateChange` subscriptions that lived in both `page.tsx` and `Auth.tsx`.
    - **Types:** `DCFResult` and `DcfParams` exported from `src/lib/dcf.ts`. `any` eliminated from `page.tsx` via `Peer`, `SavedAnalysis`, `ChatMessage`, `AiDcfParams`, `ChatType`. Pre-existing `any` usages in chart components also cleaned up.
    - **A11y:** Dropped `userScalable: false` from viewport.

9.  **Claude Design UI Redesign (2026-04-28):**
    - **Layout overhaul:** Replaced centered `max-w-6xl` Tailwind layout with full-width topbar + 296px left sidebar + scrolling right pane (matches `dcf-kong/project/DCF Kong UI.html` handoff bundle).
    - **Design tokens:** Migrated `globals.css` to a CSS-variable design system (`--bg`, `--surface`, `--text`, `--blue`, etc.) with a `[data-theme="dark"]` override for full dark-mode swap on `<html>`.
    - **Sticky valuation header:** New always-visible bar shows Ticker · Market Price · Intrinsic · Upside · MoS bar · TV % · Bear/Base/Bull pills.
    - **Margin of Safety bar:** Color-coded (red/amber/green) progress bar inside the intrinsic value card, thresholded at 0/15/30%.
    - **TV % warning:** Auto-fires amber banner when `presentTerminalValue / enterpriseValue > 75%`.
    - **Scenario range card:** Plots bear / base / bull intrinsic values on a shared axis vs. market price line. Computed from `baseParams` via three additional `useMemo` calls to `calculateDCF`.
    - **Tooltip explainers:** Every slider now has a `?` badge with plain-English copy for WACC, growth, terminal growth, etc. (`SLIDER_TIPS` constant in `page.tsx`).
    - **Floating chat FAB + drawer:** Chatbot moved from bottom-of-page to a fixed bottom-right FAB that toggles a slide-up drawer. Unread badge increments while drawer is closed and an assistant reply arrives.
    - **Dark mode:** 🌙 toggle in topbar, persists via `localStorage["dcf-theme"]`. Applied to `<html data-theme>`.
    - **Export CSV:** New `exportCSV` writes `dcfResult.projectedFCF` + growth rates + summary as a CSV blob.
    - **Share link:** New `handleShare` copies `window.location.href` via `navigator.clipboard` with a toast confirmation.
    - **Scope (option A):** Top-level page only; child components (`SensitivityTable`, `PeerComparisonTable`, `StockPriceChart`, `HistoricalFCFChart`, `Auth`) keep their existing Tailwind classes — dark mode renders inconsistently inside those cards by design.

10. **Code Review Pass — Top 5 Fixes (2026-04-29):**
    - **Sensitivity table correctness:** `SensitivityTable` now receives `transitionYears`, `totalCash`, `totalDebt` and forwards them to `calculateDCF`. The highlighted "current" cell now matches the headline value when cash/debt are non-zero (was using default 5y transition + zero cash/debt). Cell-match uses `Math.abs(...) < 1e-6` tolerance instead of float `===`.
    - **Prompt-injection hardening:** `/api/chat` sets `systemInstruction`, wraps every user value in `<user_input>...</user_input>` delimiters, tightens ticker validation to `/^[A-Z0-9.\-=^]{1,32}$/`, and rejects empty/invalid tickers before hitting Gemini. Lazy `genAI` init removes the empty-string fallback. Chat history now coalesces consecutive same-role turns.
    - **Supabase loud-fail:** `src/lib/supabase.ts` placeholder client replaced with a Proxy that throws a descriptive error on any access when env vars are missing — silent network errors against `placeholder.supabase.co` no longer possible.
    - **API input validation:** `/api/stock` and `/api/stocks` reject malformed tickers (regex), dedupe, and cap `/api/stocks` to 20 tickers per request.
    - **DCF unit tests:** Added Vitest (`npm test` / `npm run test:watch`) and `src/lib/dcf.test.ts` with 14 tests covering error paths, two-stage projection, Gordon growth terminal value, equity bridge, edge cases (zero/negative growth, transitionYears=0). All passing.

11. **Chat Reliability Pass — Scratchpad Leak, Error Hints, Model Switch (2026-05-07):**
    - **Problem A (scratchpad leak):** Gemma (`gemma-4-31b-it`) prefixed chat replies with a planning preamble — analysis of the user's request, role/constraint summaries, and a plan line — before the actual answer.
    - **First attempt (commit `a07a371`):** `stripLeakedThoughts` heuristically removed a contiguous leading bullet/blank block when meta-phrases were present. Insufficient — leaks that started with prose ("The user is asking…") slipped through unchanged. Code-review pass had flagged this exact shape at confidence 75; treated as runner-up and shipped anyway. Lesson logged as a feedback memory.
    - **Second attempt (commit `8796d22`):** Replaced with `extractAnswer` — pulls content out of literal `[[ANSWER]]…[[/ANSWER]]` markers; falls back to the last paragraph if the model ignored markers. System instruction split into `SYSTEM_INSTRUCTION_BASE` (role + injection defense, used by JSON paths so their `"Only return JSON"` rule isn't fought by the marker rule) and `SYSTEM_INSTRUCTION_FREEFORM` (BASE + marker requirement, used by `chat` and `commentary`). Deterministic and testable; no more arms race against Gemma's leak shapes.
    - **Problem B (misleading 500 error):** `src/app/page.tsx` chat catch-block unconditionally appended `". Please ensure GEMINI_API_KEY is set in your environment."` to every error, including transient Google-side 500s where the key was fine. Fixed in `8796d22` with conditional hints: auth signals → API-key hint; `5xx`/`UNAVAILABLE`/`overloaded` → "Gemini side, try again"; otherwise → generic retry.
    - **Problem C (capacity):** User reported a demand spike on shared `gemma-*` infra causing repeated 500s. Switched the model to `gemini-3.1-flash-lite` (commit `2a10d96`). Gemini 3.x flash-lite has its own provisioned capacity and separated thinking tokens; leak frequency should drop sharply. The `[[ANSWER]]` delimiter extraction stays in place as defense-in-depth.
    - **Default theme:** Confirmed light is the default; `layout.tsx` sets `data-theme="light"`, `page.tsx` initializes dark toggle to `false`. No code change needed; saved as a feedback memory.

### 📍 Next Steps
1.  **Multi-Scenario Comparison:** Allow users to save and compare Bear, Base, and Bull cases side-by-side.
2.  **Portfolio Tracking:** Aggregate valuation dashboard for all saved analyses.
3.  **Explicit "Set as Base" control:** `baseParams` currently only updates on AI research — a manual button would let users anchor bull/bear scenarios around their edited values.

---

## 🔗 History
- Initial Checkpoint: `98d3ede`
- Auth & Database Checkpoint: `2510bd0`
- Final Polish Checkpoint: `a5fdb91`
- Advanced DCF & PWA Checkpoint: `e793993`
- Financial & Technical Checkpoint: `aa7d490`
- Bug Fixes & Hardening Checkpoint: `3b627e6`
- Code Review Hardening Checkpoint: `94ef228`
- Claude Design UI Redesign Checkpoint: `956dcc3`
- Code Review Pass (Top 5 Fixes) Checkpoint: `a365025`
- Chat Scratchpad Leak Strip Checkpoint: `a07a371`
- Chat Reliability Pass Checkpoint: `2a10d96` (Latest)
