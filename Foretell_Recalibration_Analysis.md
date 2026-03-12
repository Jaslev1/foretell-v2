# Foretell Recalibration Analysis
## Based on 279 Real Bets ($-216 P&L)

---

## THE CORE PROBLEMS

### 🚨 CRITICAL ISSUE #1: Terrible Win/Loss Ratio

**Current Performance:**
- Win Rate: 67.4% (good!)
- Average Win: $3.07
- Average Loss: $-8.71
- **Win/Loss Ratio: 0.35x** ← DISASTER

**What this means:**
You need to win 3 bets to cover 1 loss. With 67% win rate, the math doesn't work:
- 67 wins × $3.07 = $206
- 33 losses × $8.71 = $287
- **Net: -$81 per 100 bets**

**Root Cause:** Betting on HIGH PROBABILITY outcomes (60-100¢) with LOW PAYOUTS

---

### 🚨 CRITICAL ISSUE #2: Favorite Bias

**Performance by Entry Price:**
- 60-80¢: $-39.65 loss (174 bets = 62% of all bets!)
- 80-100¢: $-47.18 loss (53 bets)
- **Combined 60-100¢: $-86.83 loss on 227 bets**

**Versus lower probabilities:**
- 0-20¢: $-29.82 (but only 5 bets, 0% win rate)
- 20-40¢: $-31.65 (only 11 bets)
- 40-60¢: $-67.85 (36 bets)

**The Problem:** 
Foretell is finding "high confidence" bets, which are just expensive favorites. When they lose, you lose BIG. When they win, you make pennies.

---

### 🚨 CRITICAL ISSUE #3: 1-6 Hour Holding Period = Death Zone

**Performance by hold time:**
- <1hr: **+$24.52** (78.9% WR) ← PROFITABLE!
- **1-6hr: -$155.38** (60.6% WR) ← MASSIVE LOSSES
- 6-24hr: **+$41.81** (85.3% WR) ← PROFITABLE!
- 1-3days: -$87.06 (54.5% WR)
- >3days: -$40.04 (61.3% WR)

**Insight:** 
Quick flips (<1hr) and same-day holds (6-24hr) are profitable. But the 1-6hr window is getting hammered. This suggests:
- Market makers squeeze you in that window
- You're betting on events that resolve unfavorably in 1-6hrs
- Prices move against you during this period

---

### 🚨 CRITICAL ISSUE #4: MAX LOSS CONCENTRATION

**Top 10 worst markets:**
All lost $-9.94 to $-19.86

**Pattern:** These are all-or-nothing bets where you:
- Bought YES at 70-90¢
- Event didn't happen
- Lost entire stake

**Examples:**
- KXATTENDSOTU-AOC ($-9.94 on 85 contracts) - AOC didn't attend SOTU
- Multiple sports matches at high confidence
- Tournament outcomes

---

## ROOT CAUSE DIAGNOSIS

### Foretell's Current Algorithm is Optimizing for:
1. ✅ High Confidence (finds 60-90% probability events)
2. ❌ But NOT for Expected Value
3. ❌ NOT accounting for downside risk
4. ❌ NOT filtering out favorite bias

### Why This Fails:
- Buying YES at 80¢ means you risk $0.80 to make $0.20
- 4:1 risk/reward ratio
- **You need 80% win rate to break even**
- You're getting 77.4% win rate at 80-100¢ → **LOSING MONEY**

---

## RECALIBRATION STRATEGY

### FIX #1: Expected Value Filter (CRITICAL)

**Current:** Foretell finds high probability bets
**New:** ONLY show bets with positive EV accounting for fees

**Formula:**
```
EV = (Win% × Payout) - (Loss% × Risk) - Fees
```

**New Minimum Thresholds:**
- EV must be > 5% (not just > 0%)
- Kelly Criterion sizing: Bet size = (Edge / Odds)
- Filter out any bet where max loss > 3× max win

**Example:**
- OLD: YES at 85¢ with 87% confidence → ACCEPT
  - EV = (0.87 × $0.15) - (0.13 × $0.85) = $0.02 (barely positive)
  - Reality: Fees eat this, variance kills you

- NEW: REJECT unless:
  - EV > $0.05 per contract
  - Confidence > (Price + 5%)
  - Example: Only buy YES at 85¢ if confidence is 90%+

---

### FIX #2: Reverse the Bias - Hunt Underdogs

**Current Performance:**
- Favorites (60-100¢): -$86.83 loss
- Underdogs (0-60¢): -$129.32 loss (but MUCH smaller sample)

**New Strategy:**
Look for UNDERPRICED outcomes, not just high-confidence outcomes

**Opportunities:**
- YES at 30¢ with 40% estimated probability
  - Risk $0.30 to make $0.70
  - EV = (0.40 × $0.70) - (0.60 × $0.30) = $0.10
  - **2.3x better EV than buying favorites**

**Filter criteria:**
- Estimated probability > Market price + 10%
- Example: 45% confidence on a 30¢ market
- Avoid 85% confidence on 80¢ markets

---

### FIX #3: Time-Based Filtering

**What works:**
- ✅ <1 hour holds: +$24.52
- ✅ 6-24 hour holds: +$41.81

**What doesn't:**
- ❌ 1-6 hour holds: -$155.38

**New Rules:**
1. **Prioritize same-day resolution events**
   - Filter: Event closes within 6-24 hours
   - These showed 85.3% win rate

2. **Flag 1-6 hour resolution as YELLOW**
   - Require 2x the normal EV threshold
   - This window has adverse selection

3. **Limit multi-day holds**
   - These had 54-61% win rates (below target)
   - More time = more variance

---

### FIX #4: Category-Specific Calibration

**Sports markets:** 
Current approach failing (many in worst 10)

**New filters:**
- Don't bet on heavy favorites in sports (>70¢)
- Sports have favorite bias built into market prices
- Focus on spread markets, not outright winners

**Political markets:**
- KXATTENDSOTU losses: Ignore attendance/ceremonial predictions
- These are binary with poor pricing
- Focus on polling-based markets with data

**Entertainment:**
- Best performers in top 10 (KXTOPMODEL, KXTRUMPSAY)
- Keep entertainment, but size smaller

---

### FIX #5: Risk Score Recalibration

**Current Risk Score Formula (assumed):**
```
risk_score = base_score
  - (volume > 200k ? 2 : 0)
  - (spread < 0.05 ? 1 : 0)
  + (probability 0.45-0.55 ? 1 : 0)
```

**NEW Risk Score Formula:**
```
risk_score = base_score
  + asymmetric_risk_penalty
  + favorite_bias_penalty
  - underdog_bonus
  + time_window_adjustment
```

**Where:**
```javascript
// Asymmetric Risk Penalty
const maxLoss = price;
const maxWin = 1 - price;
const riskRewardRatio = maxLoss / maxWin;

if (riskRewardRatio > 3) risk_score += 3;  // 80¢+ YES bets
else if (riskRewardRatio > 2) risk_score += 2;  // 67¢+ YES bets
else if (riskRewardRatio > 1.5) risk_score += 1;  // 60¢+ YES bets

// Favorite Bias Penalty
if (price > 0.70 && probability > 0.70) {
  risk_score += 2;  // Double penalty for buying expensive favorites
}

// Underdog Bonus
if (price < 0.40 && probability > price + 0.10) {
  risk_score -= 2;  // Reward finding underpriced underdogs
}

// Time Window Adjustment
const hoursToClose = (close_time - now) / 3600000;
if (hoursToClose >= 6 && hoursToClose <= 24) {
  risk_score -= 1;  // Sweet spot: 6-24 hour window
} else if (hoursToClose >= 1 && hoursToClose < 6) {
  risk_score += 2;  // Danger zone: 1-6 hour window
}
```

---

### FIX #6: Expected Value Display

**Add to each opportunity card:**

```
Current Display:
- Probability: 82%
- Volume: $125k
- Risk Score: 3

NEW Display:
- Probability: 82%
- Market Price: 78¢
- Edge: +4%
- Expected Value: $0.06 per contract
- Max Win: $22 | Max Loss: $78
- Risk/Reward: 3.5:1 ⚠️
- Recommended Size: 2 contracts (Kelly: 8% of bankroll)
```

---

## IMPLEMENTATION PRIORITY

### IMMEDIATE (Deploy Today):

1. **Add EV Filter:**
```javascript
const calculateEV = (probability, price, feeRate = 0.07) => {
  const payout = 1 - price;
  const risk = price;
  const expectedReturn = (probability * payout) - ((1 - probability) * risk);
  const fees = (price + Math.abs(payout - price)) * feeRate;
  return expectedReturn - fees;
};

// Filter: Only show if EV > 0.05
if (calculateEV(probability, yes_ask) < 0.05) {
  continue;  // Skip this market
}
```

2. **Add Risk/Reward Ratio:**
```javascript
const riskRewardRatio = price / (1 - price);
if (riskRewardRatio > 3) {
  riskScore += 3;  // Heavy penalty
}
```

3. **Add Time Window Filter:**
```javascript
const hoursToClose = (close_time - Date.now()) / 3600000;
if (hoursToClose >= 6 && hoursToClose <= 24) {
  riskScore -= 1;  // Boost these
}
```

### MEDIUM TERM (This Week):

4. **Add underdog hunting:**
   - Flip the script: Look for cheap bets with edge
   - Filter: `probability > (price + 0.10)`

5. **Category-specific filters:**
   - Sports: Max price 60¢
   - Political: Avoid ceremonial/attendance
   - Entertainment: Keep but size smaller

6. **Display EV and risk/reward** on cards

### LONG TERM (Next Week):

7. **Kelly Criterion position sizing**
8. **Backtest new filters on historical data**
9. **Add "confidence level" based on data quality**

---

## EXPECTED IMPROVEMENT

### Current State:
- 279 bets
- $-216 P&L
- -9.43% ROI
- 67.4% win rate, but 0.35x win/loss ratio

### After Recalibration (Projected):
- Fewer bets (100-150) but higher quality
- Targeting 60-65% win rate with 1.5x+ win/loss ratio
- Expected: +5% to +15% ROI
- Focus on 6-24hr window sweet spot

### Why This Works:
- Current: Finding "will probably win" (favorites)
- New: Finding "underpriced relative to probability" (value)

The goal isn't to be right more often - it's to make more when right and lose less when wrong.

---

## QUICK WINS TO IMPLEMENT NOW

### 1. Filter Out Expensive Favorites
```javascript
// In your market filtering
if (yes_ask > 0.70 && riskScore > 5) {
  continue;  // Skip expensive high-risk bets
}
```

### 2. Prioritize Underpriced Markets
```javascript
// Boost markets where you have edge
const edge = probability - yes_ask;
if (edge > 0.10) {
  riskScore -= 2;  // Make these show up higher
}
```

### 3. Time Window Sweet Spot
```javascript
const hoursToClose = (close_time - Date.now()) / 3600000;
if (hoursToClose < 6 || hoursToClose > 24) {
  riskScore += 1;  // Penalize outside sweet spot
}
```

---

## BOTTOM LINE

**Problem:** Foretell finds high-confidence bets, not high-value bets

**Solution:** Completely invert the approach:
1. Start with EV calculation (must be >5%)
2. Then filter by risk/reward ratio (<3:1)
3. Then apply time window (6-24hr sweet spot)
4. THEN look at confidence

**Result:** Fewer bets, but profitable ones

Your 67% win rate is GOOD. The problem is you're winning pennies and losing dollars. Fix the asymmetry, fix the P&L.
