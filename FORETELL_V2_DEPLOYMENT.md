# Foretell v2.0 - Recalibrated Deployment Guide

## What Changed

Based on your 279-bet analysis ($-216 P&L), I've recalibrated Foretell to fix:

1. **Favorite Bias** - Was betting on expensive 60-100¢ markets
2. **Poor Win/Loss Ratio** - Was winning $3.07 avg but losing $8.71 avg  
3. **Time Window Issues** - 1-6hr holds lost $155, but 6-24hr made $42
4. **No EV Filter** - Was showing "high confidence" not "high value" bets

## Files to Update

### 1. api/kalshi-markets.js (Backend)
**Location:** `/api/kalshi-markets.js`
**Action:** Replace entire file with the new recalibrated version

**Key changes:**
- ✅ Added Expected Value calculation (must be >5%)
- ✅ Added Risk/Reward Ratio filter (rejects >4:1)
- ✅ Penalizes expensive favorites (60-100¢)
- ✅ Rewards underdogs with strong edge
- ✅ Time window optimization (boosts 6-24hr, penalizes 1-6hr)
- ✅ Category-specific filters (sports, politics adjustments)

**New fields returned:**
```javascript
{
  expectedValue: 0.08,  // EV as decimal (8%)
  edge: 0.05,           // Confidence - Market Price
  riskRewardRatio: 2.3, // How much you risk vs win
  maxWin: 0.25,         // Max profit per contract
  maxLoss: 0.75,        // Max loss per contract
  yesPrice: 0.75,       // Market price to buy YES
  hoursToExpiry: 18     // Hours until event closes
}
```

### 2. foretell.jsx (Frontend) - OPTIONAL
**Location:** `/foretell.jsx`
**Action:** Update the metrics display section (lines 941-983)

The backend changes alone will improve results. Frontend changes just show the new metrics to users.

**What the new display shows:**
- Expected Value % (highlights >10% opportunities)
- Edge over market price
- Risk/Reward ratio with warning if >3:1
- Max Win / Max Loss in dollars
- Market price in cents

## Deployment Steps

### Option A: Backend Only (Quickest)

1. **Replace api/kalshi-markets.js**
   - Download the new `kalshi-markets.js` file from outputs
   - Replace the file in your `api/` folder
   - Commit to GitHub: `git add api/kalshi-markets.js && git commit -m "Recalibrate to v2.0"`
   - Push: `git push`
   - Vercel auto-deploys in 30 seconds

2. **Test**
   - Visit your Foretell URL
   - Click Refresh
   - You should see:
     - Fewer total opportunities (higher quality filter)
     - Different opportunities ranked higher
     - Risk scores recalculated

### Option B: Full Update (Backend + Frontend)

1. **Replace both files**
   - `api/kalshi-markets.js` - Backend algorithm
   - Update metrics section in `foretell.jsx` - Frontend display

2. **Commit and push**
   ```bash
   git add api/kalshi-markets.js foretell.jsx
   git commit -m "Foretell v2.0 - Recalibrated with EV filtering"
   git push
   ```

3. **Vercel auto-deploys**

## Expected Results

### Before (Current):
- 279 bets, -$216 P&L (-9.43% ROI)
- 67.4% win rate but terrible win/loss ratio (0.35x)
- 81% of bets on expensive favorites (60-100¢)

### After (Projected):
- Fewer bets (100-150) but higher quality
- 60-65% win rate with BETTER win/loss ratio (1.5x+)
- Target: +5% to +15% ROI
- Focus on underdogs with edge and 6-24hr sweet spot

## What You'll See Different

### More Opportunities Like:
- YES at 35¢ with 48% confidence (13% edge, 1.9:1 risk/reward)
- YES at 55¢ with 68% confidence (13% edge, 1.2:1 risk/reward)
- Events closing in 8-20 hours

### Fewer Opportunities Like:
- YES at 85¢ with 87% confidence (2% edge, 5.7:1 risk/reward) ❌
- Events closing in 2-5 hours ❌
- Sports favorites >70¢ ❌
- Political attendance markets ❌

## Monitoring

After deploying, track:

1. **Total opportunities shown** - Should drop from ~100 to 40-60
2. **Average YES price** - Should drop from ~75¢ to ~50¢
3. **Average EV** - Should be >8% (vs implied ~2% before)
4. **Risk scores** - More opportunities at 3-5, fewer at 7-9

## Files Included

✅ **api/kalshi-markets.js** - Recalibrated backend (REQUIRED)
✅ **foretell_metrics_update.jsx** - New display code (OPTIONAL)
✅ **Foretell_Recalibration_Analysis.md** - Full analysis

## Quick Deploy

**Fastest path:**
1. Download `kalshi-markets.js` from outputs
2. Replace `api/kalshi-markets.js` in your project
3. `git commit -am "v2.0" && git push`
4. Done! Vercel auto-deploys

## Questions?

The key insight: Your 67% win rate was GOOD. The problem was betting on expensive favorites where wins paid pennies and losses cost dollars. V2.0 flips the script to hunt value, not just confidence.
