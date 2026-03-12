# Foretell v2.1 - Quick Fix

## What Happened

v2.0 was **TOO aggressive** with filters:
- 5% EV threshold → Nothing passed
- 7% fee estimate → Too high
- Result: "No opportunities found"

## v2.1 Adjustments

**Fixed:**
1. ✅ EV threshold: 5% → **2%** (more realistic)
2. ✅ Fees: 7% → **3.5%** (actual Kalshi fees)
3. ✅ Expensive favorite filter: Edge >10% → **>5%** (more lenient)
4. ✅ Added volume filter: >10k minimum

## Test Results

**Sample markets passing v2.1 filters:**
- ✅ 65¢ with 70% confidence (2.7% EV, 1.9:1 R/R)
- ✅ 45¢ with 52% confidence (5.4% EV, 0.8:1 R/R) 
- ✅ 35¢ with 42% confidence (5.8% EV, 0.5:1 R/R)
- ✅ 25¢ with 30% confidence (4.1% EV, 0.3:1 R/R)

**Still filtered out (good!):**
- ❌ 85¢ with 87% confidence (-1.0% EV, 5.7:1 R/R) - Expensive favorite
- ❌ 75¢ with 78% confidence (0.4% EV, 3.0:1 R/R) - Below EV threshold

## Deploy

1. Download `kalshi-markets-v2.1.js`
2. Rename to `kalshi-markets.js`
3. Replace `api/kalshi-markets.js` in your project
4. `git add api/kalshi-markets.js && git commit -m "v2.1 adjusted filters" && git push`
5. Vercel auto-deploys

## Expected Results

- **Should see:** 20-50 opportunities (not 0, not 100)
- **Average price:** ~50¢ (not 75¢)
- **Average EV:** 3-5% (positive expected value)
- **Still avoiding:** Expensive favorites with poor EV

## What v2.1 Still Does (Good Stuff)

✅ Filters out expensive favorites (>70¢ without 5%+ edge)
✅ Filters out terrible risk/reward (>4:1)
✅ Prioritizes 6-24hr events
✅ Penalizes 1-6hr danger zone
✅ Hunts underdogs with edge
✅ Category-specific adjustments (sports, politics)

The filters are still active - just not so aggressive that nothing passes!
