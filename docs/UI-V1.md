# Alpha Terminal V1.0 Product Prototype

Subtitle: AI Trading Workspace

Role: Senior Product Designer

Status: Product prototype only. No implementation. No market data integration.

Design references:

- TradingView: chart discipline, watchlist familiarity, fast scanning.
- Bloomberg Terminal: dense professional context, command confidence, no decorative fluff.
- Linear: calm hierarchy, sharp spacing, minimal navigation.
- Notion: readable document/report structure, modular blocks.
- Apple Human Interface: clarity, restraint, immediate affordance.

Do not reference:

- Eastmoney-style portal density.
- Tonghuashun-style indicator overload.
- Traditional retail quote-board clutter.

Core principle:

> Less is More. The product should reduce decision noise, not decorate uncertainty.

---

## 1. Product North Star

Alpha Terminal is not a stock quote site.

It is a daily trading workspace for a professional or semi-professional trader who needs to answer five questions quickly:

1. How is the market today?
2. Is today worth trading?
3. What is the main theme?
4. Which stock deserves the most attention?
5. When should I buy, and when should I not buy?

The product should feel quiet, decisive, and analytical.

The first screen must be useful before the user scrolls.

The AI layer should act as a decision summarizer and explanation layer, not a magic recommender.

---

## 2. Information Architecture

Only five primary pages remain.

```text
Alpha Terminal
AI Trading Workspace

+------------------------------------------------------+
| Primary Navigation                                   |
+------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings    |
+------------------------------------------------------+
```

### 2.1 Page Responsibilities

| Page | Job | What It Must Not Become |
|---|---|---|
| Dashboard | Daily decision cockpit | A full market data portal |
| Watchlist | Focused stock decision cards | A giant quote table |
| Reports | Structured pre/in/post-market reports | Random chat output archive |
| News | Signal-relevant news and announcements | General financial news feed |
| Settings | Data, model, risk, display preferences | A confusing admin panel |

### 2.2 Secondary Navigation

Secondary navigation should be contextual, not global.

Examples:

- Dashboard: Today / Market / Theme / Best Setup
- Watchlist: All / Buyable / Waiting / Risk
- Reports: Pre-market / Intraday / Post-market
- News: Important / Watchlist / Macro / Announcements
- Settings: Data / Model / Risk / Display

---

## 3. Global Layout System

### 3.1 Desktop Shell

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                         Market Open | Data: Demo | 2026-07-14    |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  Page Content                                                                  |
|                                                                                |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 3.2 Layout Rules

- One horizontal top navigation.
- No permanent left sidebar in V1.0.
- Use a command-like top bar only when useful.
- Keep surfaces flat and calm.
- Use cards only for decision blocks, not decoration.
- Prefer fewer sections with stronger meaning.
- Avoid dense color. Color should mean state.

### 3.3 State Colors

```text
Green  = acceptable action / healthy setup
Blue   = neutral information / observation
Amber  = caution / wait / not confirmed
Red    = risk / avoid / invalid
Gray   = unavailable / stale / disabled
```

### 3.4 Typography

Hierarchy:

```text
Page title            24-28
Decision headline     20-24
Section title         14-16
Body                  13-14
Meta                  11-12
```

Rules:

- No oversized marketing hero.
- Numbers should align and scan cleanly.
- Labels should be short.
- Explain only when explanation changes behavior.

---

## 4. Dashboard

Dashboard is the daily cockpit.

It must answer five questions within 30 seconds:

1. Market condition.
2. Trade or not.
3. Main theme.
4. Best stock to watch.
5. Buy / wait / avoid conditions.

### 4.1 Dashboard Information Priority

```text
Priority 1: Today decision
Priority 2: Best setup
Priority 3: Main theme
Priority 4: Market context
Priority 5: Watchlist exceptions
```

### 4.2 Dashboard Desktop Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  DASHBOARD                                                                     |
|  AI Trading Workspace                                                          |
|                                                                                |
|  +-------------------------------+  +---------------------------------------+   |
|  | TODAY'S CALL                  |  | BEST SETUP                            |   |
|  |                               |  |                                       |   |
|  | Market: Strong but selective  |  | 双环传动 002472                       |   |
|  | Trade Mode: Wait for pullback |  | Signal: Buy only near planned zone    |   |
|  | Risk: Medium                  |  | Confidence: A                         |   |
|  |                               |  |                                       |   |
|  | [Do not chase]                |  | Entry: 27.80 - 28.60                  |   |
|  |                               |  | Stop: 25.70                           |   |
|  +-------------------------------+  | Target: 31.40 / 33.60                 |   |
|                                     +---------------------------------------+   |
|                                                                                |
|  +-------------------------------+  +---------------------------------------+   |
|  | MAIN THEME                    |  | BUY / DO NOT BUY                      |   |
|  |                               |  |                                       |   |
|  | Robotics                      |  | Buy if:                               |   |
|  | AI Hardware                   |  | - Price returns to entry zone         |   |
|  | Innovative Medicine           |  | - Volume stays healthy                |   |
|  |                               |  | - Market mood remains valid           |   |
|  | Theme Quality: Good           |  |                                       |   |
|  | Theme Risk: Crowding rising   |  | Do not buy if:                        |   |
|  +-------------------------------+  | - Price above chase limit             |   |
|                                     | - Market turns weak                   |   |
|                                     | - Risk/reward below threshold         |   |
|                                     +---------------------------------------+   |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | WATCHLIST ATTENTION                                                      |  |
|  |                                                                          |  |
|  |  Stock        State       Why it matters                    Action        |  |
|  |  双环传动     A setup     Robotics leader, trend intact      Wait zone     |  |
|  |  沪电股份     B setup     AI hardware strength               Watch pullback |
|  |  众生药业     B setup     Medicine theme recovery            Confirm volume|
|  |  光启技术     Risk        High volatility                    Reduce focus   |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 4.3 Dashboard Mobile Wireframe

```text
+--------------------------------------+
| Alpha Terminal            Demo 09:30 |
+--------------------------------------+
| Dash | Watch | Reports | News | Set  |
+--------------------------------------+
|                                      |
| TODAY'S CALL                         |
| Market: Strong but selective         |
| Mode: Wait for pullback              |
| Risk: Medium                         |
|                                      |
| [Do not chase]                       |
|                                      |
+--------------------------------------+
| BEST SETUP                           |
| 双环传动 002472                      |
| Signal: A                            |
| Entry: 27.80 - 28.60                 |
| Stop: 25.70                          |
| Target: 31.40 / 33.60                |
+--------------------------------------+
| MAIN THEME                           |
| 1. Robotics                          |
| 2. AI Hardware                       |
| 3. Innovative Medicine               |
+--------------------------------------+
| BUY / DO NOT BUY                     |
| Buy if price returns to zone.        |
| Do not buy above chase limit.        |
+--------------------------------------+
```

### 4.4 Dashboard Components

#### Today's Call

Purpose:

Answer whether today is tradable.

Content:

- Market condition.
- Trade mode.
- Risk level.
- One explicit instruction.

Possible trade modes:

```text
Can trade
Light test only
Wait for pullback
Manage existing positions
No new trades
```

#### Best Setup

Purpose:

Surface only one primary stock.

Content:

- Stock name/code.
- Setup grade.
- Signal.
- Entry zone.
- Stop.
- Targets.
- One-sentence reason.

Rule:

If no valid setup exists, this block must say:

```text
No qualified setup today.
今日不开仓。
```

#### Main Theme

Purpose:

Explain where attention should go.

Content:

- Top 1-3 themes.
- Theme quality.
- Crowding/risk.
- Related watchlist stocks.

#### Buy / Do Not Buy

Purpose:

Prevent impulsive action.

Content:

- Buy condition.
- Wait condition.
- Invalid condition.
- Chase limit.

---

## 5. Watchlist

Watchlist is not a quote board.

Each stock card must answer:

1. Can I buy it?
2. Why?
3. When?
4. What is the risk?

### 5.1 Watchlist Desktop Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  WATCHLIST                                                                     |
|  20 focused names. No noise.                                                   |
|                                                                                |
|  Filter: [All] [Buyable] [Waiting] [Risk]     Search: [ code / name       ]    |
|                                                                                |
|  +-----------------------------+  +-----------------------------+              |
|  | 双环传动 002472             |  | 沪电股份 002463             |              |
|  | Robotics                    |  | AI Hardware                 |              |
|  |                             |  |                             |              |
|  | Decision: Buy near zone     |  | Decision: Wait              |              |
|  | Why: Trend + theme aligned  |  | Why: Strong but extended    |              |
|  | When: 27.80 - 28.60         |  | When: Pullback to MA10      |              |
|  | Risk: Medium                |  | Risk: Chasing risk          |              |
|  |                             |  |                             |              |
|  | Score: 91  R/R: 2.1         |  | Score: 86  R/R: 1.7         |              |
|  | [Open Detail]               |  | [Open Detail]               |              |
|  +-----------------------------+  +-----------------------------+              |
|                                                                                |
|  +-----------------------------+  +-----------------------------+              |
|  | 众生药业 002317             |  | 光启技术 002625             |              |
|  | Innovative Medicine         |  | Advanced Manufacturing      |              |
|  |                             |  |                             |              |
|  | Decision: Wait confirmation |  | Decision: Avoid             |              |
|  | Why: Rebound not confirmed  |  | Why: High volatility        |              |
|  | When: Volume improves       |  | When: Not today             |              |
|  | Risk: False breakout        |  | Risk: Distribution          |              |
|  |                             |  |                             |              |
|  | Score: 82  R/R: 1.6         |  | Score: 61  R/R: invalid     |              |
|  | [Open Detail]               |  | [Open Detail]               |              |
|  +-----------------------------+  +-----------------------------+              |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 5.2 Watchlist Mobile Wireframe

```text
+--------------------------------------+
| WATCHLIST                            |
| Search [002472]                      |
| All | Buyable | Waiting | Risk       |
+--------------------------------------+
| 双环传动 002472                      |
| Decision: Buy near zone              |
| Why: Trend + theme aligned           |
| When: 27.80 - 28.60                  |
| Risk: Medium                         |
| Score 91 | R/R 2.1                   |
+--------------------------------------+
| 沪电股份 002463                      |
| Decision: Wait                       |
| Why: Strong but extended             |
| When: Pullback to MA10               |
| Risk: Chasing risk                   |
+--------------------------------------+
```

### 5.3 Card Anatomy

```text
+--------------------------------------+
| Stock Name + Code                    |
| Sector / Theme                       |
|                                      |
| Decision                             |
| Why                                  |
| When                                 |
| Risk                                 |
|                                      |
| Score | R/R | Updated                |
| [Open Detail]                        |
+--------------------------------------+
```

### 5.4 Watchlist Sorting

Default sort:

```text
Decision quality first
Then risk/reward
Then freshness
Then theme relevance
```

Do not default to:

- Price change.
- Turnover.
- Volume spike.
- Alphabetical list.

### 5.5 Watchlist Filters

```text
All
Buyable
Waiting
Holding
Risk
Invalid
```

Each filter should reduce cognitive load.

---

## 6. Stock Detail

Stock detail must not start with indicators.

The page order is:

1. AI conclusion.
2. Buy/sell plan.
3. Scoring evidence.
4. Technical indicators.
5. Historical chart.

### 6.1 Stock Detail Desktop Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  < Back to Watchlist                                                           |
|                                                                                |
|  双环传动 002472                                                               |
|  Robotics | Updated 09:30                                                      |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | 1. AI CONCLUSION                                                         |  |
|  |                                                                          |  |
|  | This is today's strongest setup, but only valid near the planned entry.   |  |
|  | Do not chase if price moves above the chase limit.                        |  |
|  |                                                                          |  |
|  | Decision: Buy near zone                                                   |  |
|  | Confidence: A                                                             |  |
|  | Main risk: crowded robotics theme                                         |  |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
|  +-----------------------------------+  +-----------------------------------+   |
|  | 2. BUY / SELL PLAN                |  | PLAN VALIDATION                  |   |
|  |                                   |  |                                   |   |
|  | Entry 1: 27.80 - 28.60            |  | Buy if: returns to entry zone     |   |
|  | Entry 2: 26.35 - 27.05            |  | Wait if: above chase limit        |   |
|  | Chase Limit: 30.10                |  | Avoid if: breaks 25.70            |   |
|  | Stop: 25.70                       |  |                                   |   |
|  | Target 1: 31.40                   |  | R/R: 2.1                          |   |
|  | Target 2: 33.60                   |  | Status: valid                     |   |
|  +-----------------------------------+  +-----------------------------------+   |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | 3. SCORING EVIDENCE                                                      |  |
|  |                                                                          |  |
|  | Short-term Score: 91 A                                                    |  |
|  | [Theme 18/20] [Trend 19/20] [Volume 17/20] [Momentum 18/20] [R/R 19/20]   |
|  |                                                                          |  |
|  | Mid-term Score: 84 Holding                                                |  |
|  | [Industry 17/20] [Trend 22/25] [Cycle 16/20] [Drawdown 13/15] [Volume 16] |
|  |                                                                          |  |
|  | Why it scored well:                                                       |  |
|  | - MA structure supports trend.                                             |  |
|  | - Volume is healthy but not extreme.                                       |  |
|  | - Risk/reward remains acceptable.                                          |  |
|  |                                                                          |  |
|  | Warnings:                                                                 |
|  | - Do not chase above limit.                                                |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | 4. TECHNICAL INDICATORS                                                   |  |
|  |                                                                          |  |
|  | MA5  | MA10 | MA20 | MA60 | MACD | KDJ | RSI14 | ATR14 | 20D High/Low     |
|  | ...  | ...  | ...  | ...  | ...  | ... | ...   | ...   | ...              |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | 5. HISTORICAL CHART                                                       |  |
|  |                                                                          |  |
|  |     Price + MA5 + MA10 + MA20                                             |
|  |     Volume                                                               |
|  |                                                                          |
|  |     [                     chart area                                  ]   |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 6.2 Stock Detail Mobile Wireframe

```text
+--------------------------------------+
| < Watchlist                          |
| 双环传动 002472                      |
| Robotics | Demo Data                 |
+--------------------------------------+
| 1. AI CONCLUSION                     |
| Strongest setup today.               |
| Buy only near planned zone.          |
| Do not chase.                        |
+--------------------------------------+
| 2. BUY / SELL PLAN                   |
| Entry 1: 27.80 - 28.60               |
| Entry 2: 26.35 - 27.05               |
| Stop: 25.70                          |
| Target: 31.40 / 33.60                |
| R/R: 2.1                             |
+--------------------------------------+
| 3. SCORING EVIDENCE                  |
| Short: 91 A                          |
| Mid: 84 Holding                      |
| Theme, trend, volume, momentum       |
+--------------------------------------+
| 4. TECHNICAL INDICATORS              |
| MA / MACD / KDJ / RSI / ATR          |
+--------------------------------------+
| 5. HISTORICAL CHART                  |
| [chart]                              |
+--------------------------------------+
```

### 6.3 Stock Detail Design Rules

- The first sentence must be actionable.
- The plan block must show when not to buy.
- Indicators must explain, not dominate.
- Warnings should be plain language.
- Avoid indicator acronyms without context in the AI conclusion.

---

## 7. Reports

Reports are structured outputs, not chat transcripts.

The product supports:

- Pre-market.
- Intraday.
- Post-market.

All reports use the same layout.

### 7.1 Reports Landing Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  REPORTS                                                                       |
|  Structured market notes for repeatable trading review.                        |
|                                                                                |
|  [Pre-market] [Intraday] [Post-market]                                         |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | PRE-MARKET REPORT                                                        |  |
|  | Date: 2026-07-14        Data: Demo        Status: Draft-ready             |  |
|  +--------------------------------------------------------------------------+  |
|  | 1. Market State                                                          |  |
|  | Strong but selective. Risk is medium.                                    |  |
|  +--------------------------------------------------------------------------+  |
|  | 2. Trade Plan                                                            |  |
|  | Primary mode: Wait for pullback.                                         |  |
|  | No chasing above predefined levels.                                      |  |
|  +--------------------------------------------------------------------------+  |
|  | 3. Main Theme                                                            |  |
|  | Robotics remains strongest. AI hardware follows.                         |  |
|  +--------------------------------------------------------------------------+  |
|  | 4. Watchlist Focus                                                       |  |
|  | A: 双环传动                                                              |  |
|  | B: 沪电股份 / 众生药业                                                   |  |
|  +--------------------------------------------------------------------------+  |
|  | 5. Risk Notes                                                            |  |
|  | Crowding risk rising. Avoid late chase.                                  |  |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 7.2 Unified Report Structure

Every report must contain:

```text
Header
- report type
- date
- generated time
- data time
- data source
- data health

1. Market State
2. Trade Mode
3. Main Theme
4. Watchlist Focus
5. Opportunities
6. Risk Notes
7. Action Checklist
```

### 7.3 Pre-market Report

Purpose:

Prepare the day.

Must answer:

- What environment am I trading in?
- What should I watch first?
- What would make me not trade?

### 7.4 Intraday Report

Purpose:

Adjust attention without overtrading.

Must answer:

- Did market state change?
- Did the best setup trigger?
- Did any risk invalidate the plan?

### 7.5 Post-market Report

Purpose:

Review process quality.

Must answer:

- Were signals valid?
- Did price respect planned levels?
- What should change tomorrow?

---

## 8. News

News is not a newspaper.

It is a relevance filter for the watchlist and trading plan.

### 8.1 News Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  NEWS                                                                          |
|  Signal-relevant updates only.                                                 |
|                                                                                |
|  [Important] [Watchlist] [Macro] [Announcements]                               |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | IMPORTANT                                                                |  |
|  |                                                                          |  |
|  | 09:10  Robotics policy update                                            |  |
|  |       Impact: strengthens main theme                                      |  |
|  |       Related: 双环传动, 中大力德, 三花智控                               |  |
|  |       Trading impact: watch confirmation, avoid chasing                   |  |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | WATCHLIST NEWS                                                           |  |
|  |                                                                          |  |
|  | Stock      Type          Impact       Action                              |  |
|  | 002472     Theme         Positive     Keep as primary setup               |  |
|  | 002625     Volatility    Risk         Reduce focus                         |  |
|  | 002317     Medicine      Neutral      Wait for volume                      |  |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 8.2 News Item Anatomy

```text
+--------------------------------------+
| Time + Source                        |
| Headline                             |
| Why it matters                       |
| Related stocks                       |
| Trading impact                       |
| Confidence / data status             |
+--------------------------------------+
```

### 8.3 News Rules

- No infinite feed in V1.0.
- No clickbait headlines.
- Every news item must map to a trading impact:
  - strengthens plan
  - weakens plan
  - invalidates plan
  - watch only
- If impact is unclear, label it as unclear.

---

## 9. Settings

Settings should make the system trustworthy.

It must show:

- Data status.
- Model version.
- Risk rules.
- Display preferences.
- AI boundaries.

### 9.1 Settings Wireframe

```text
+--------------------------------------------------------------------------------+
| Alpha Terminal                                            Demo Data | 09:30     |
+--------------------------------------------------------------------------------+
| Dashboard | Watchlist | Reports | News | Settings                              |
+--------------------------------------------------------------------------------+
|                                                                                |
|  SETTINGS                                                                      |
|                                                                                |
|  +-------------------------------+  +---------------------------------------+   |
|  | DATA                          |  | MODEL                                 |   |
|  |                               |  |                                       |   |
|  | Source: Demo                  |  | Version: V1.0 Demo Rules              |   |
|  | Real-time: Off                |  | Short score: rule-based               |   |
|  | Database: Off                 |  | Mid score: rule-based                 |   |
|  | API Key: Not configured       |  | AI: explanation only                  |   |
|  +-------------------------------+  +---------------------------------------+   |
|                                                                                |
|  +-------------------------------+  +---------------------------------------+   |
|  | RISK RULES                    |  | DISPLAY                               |   |
|  |                               |  |                                       |   |
|  | Max A setups: 1               |  | Theme: Dark                           |   |
|  | Max B setups: 2               |  | Density: Professional                 |   |
|  | Min R/R: 1.5                  |  | Language: Chinese                     |   |
|  | No chase above limit          |  | Chart style: Minimal                  |   |
|  +-------------------------------+  +---------------------------------------+   |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | AI BOUNDARIES                                                            |  |
|  |                                                                          |  |
|  | AI may summarize, explain, and draft reports.                             |  |
|  | AI may not invent prices, bypass scoring, or promise returns.             |  |
|  +--------------------------------------------------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 9.2 Settings Principles

- Settings should explain system constraints.
- Risk rules should be visible, not hidden.
- API keys should never display raw values.
- Model version should be readable by non-engineers.

---

## 10. Interaction Model

### 10.1 Primary User Flow

```text
Open Dashboard
  -> read Today's Call
  -> inspect Best Setup
  -> check Buy / Do Not Buy
  -> open Stock Detail
  -> confirm Plan and Evidence
  -> execute externally if user chooses
```

### 10.2 Review Flow

```text
Open Reports
  -> read Pre-market plan
  -> compare Intraday changes
  -> read Post-market review
  -> adjust Watchlist tomorrow
```

### 10.3 News Flow

```text
Open News
  -> scan Important
  -> check Watchlist-related items
  -> identify plan impact
  -> return to Dashboard or Stock Detail
```

---

## 11. Content Style

### 11.1 Voice

Tone:

- calm
- precise
- professional
- restrained

Avoid:

- "must buy"
- "will rise"
- "guaranteed"
- emotional hype
- retail-trading slogans

Preferred language:

```text
Valid only near planned entry.
Risk/reward is insufficient.
Wait for pullback.
Do not chase above limit.
Setup invalid if price breaks support.
```

### 11.2 AI Conclusion Template

```text
[Stock] is [decision state] because [primary reason].
The plan is valid only if [condition].
Do not trade if [invalid condition].
Main risk: [risk].
```

Example:

```text
双环传动 is today's strongest setup because robotics remains the main theme
and trend structure is intact. The plan is valid only if price returns to the
entry zone. Do not chase above the chase limit. Main risk: theme crowding.
```

---

## 12. Data Labeling

Every page must clearly distinguish:

```text
Raw Demo Data
Algorithmic Result
Demo Scoring Input
AI Explanation
```

### 12.1 Label Examples

```text
Demo Data
Calculated
Demo Input
AI Summary
Stale
Invalid
```

### 12.2 Trust Rules

- If data is demo, say demo.
- If score uses demo input, mark it.
- If AI writes text, mark it as explanation.
- If price level is calculated, show source logic.
- If setup is invalid, show why.

---

## 13. Component Inventory

```text
AppShell
TopNavigation
DataStatusPill
PageHeader
DecisionCard
BestSetupCard
ThemeCard
BuyDontBuyCard
WatchlistDecisionCard
ReportLayout
NewsImpactCard
SettingsSection
ScoreBreakdown
TradePlanPanel
MinimalChart
RiskWarning
EmptyState
```

---

## 14. V1.0 Page Map

```text
Dashboard
  - Today's Call
  - Best Setup
  - Main Theme
  - Buy / Do Not Buy
  - Watchlist Attention

Watchlist
  - Search
  - Decision filters
  - Stock decision cards

Stock Detail
  - AI Conclusion
  - Buy / Sell Plan
  - Scoring Evidence
  - Technical Indicators
  - Historical Chart

Reports
  - Pre-market
  - Intraday
  - Post-market
  - Unified report layout

News
  - Important
  - Watchlist
  - Macro
  - Announcements

Settings
  - Data
  - Model
  - Risk Rules
  - Display
  - AI Boundaries
```

---

## 15. What V1.0 Removes

Remove:

- Large quote tables on Dashboard.
- Decorative hero sections.
- Too many tabs.
- Technical indicators above decision summary.
- News feeds without trading impact.
- Full-market heatmaps in primary view.
- Red/green noise everywhere.
- Unexplained AI recommendations.

Keep:

- Decision.
- Reason.
- Timing.
- Risk.
- Evidence.

---

## 16. Final Product Principle

Alpha Terminal should feel like a professional trading desk compressed into a calm workspace.

The user should not feel:

- flooded
- rushed
- manipulated
- entertained

The user should feel:

- oriented
- restrained
- informed
- ready to act or deliberately not act

Final mantra:

```text
One decision.
One best setup.
One plan.
Clear invalidation.
No noise.
```
