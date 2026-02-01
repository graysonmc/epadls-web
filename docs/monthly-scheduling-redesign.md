# Monthly Scheduling Redesign

## Problem Statement

The current "Every 4 Weeks" frequency creates several compounding issues:

1. **Schedule Drift**: 4 weeks = 28 days, but most months are 30-31 days. Over a year, services drift ~24 days earlier.

2. **Billing Conflict**: Services can only be billed once per calendar month. When drift causes two services to land in the same month (e.g., Oct 3rd → Oct 31st), the system wants to schedule work that can't be billed.

3. **Pileup Effect**: Naively pushing conflicting services to "first day of next month" causes all drifted services to pile up on the 1st, creating workload spikes and a different manifestation of the same problem.

4. **Weekend Complications**: Any "same day of month" approach (e.g., always the 15th) hits weekends unpredictably, requiring shifts that create their own drift patterns.

## Proposed Solution: Nth Weekday of Month

Replace fixed-interval scheduling with pattern-based monthly scheduling.

Instead of: "Every 28 days from last service"
Use: "2nd Tuesday of each month" or "Last Friday of each month"

### Why This Works

| Constraint | How It's Solved |
|------------|-----------------|
| One per month | Inherent - pattern defines exactly one date per month |
| No weekends | Inherent - pattern specifies a weekday |
| No drift | Pattern is anchored to calendar month, not previous service |
| Workload distribution | Services stay spread across the month where originally assigned |

### Tradeoff

Service intervals become variable (28-35 days) instead of fixed (28 days). This is acceptable because:
- Billing is monthly, not interval-based
- Customers expect "monthly" to mean calendar-monthly
- Variation is bounded and predictable

---

## Data Model Changes

### Current Model (Recurring Services)

```
| Job Site | Service Type | Frequency      | Start Date | Next Service |
|----------|--------------|----------------|------------|--------------|
| Site A   | Cleaning     | Every 4 Weeks  | 2024-01-15 | 2024-03-12   |
```

### Proposed Model

```
| Job Site | Service Type | Frequency | Week Pattern | Day of Week | Next Service |
|----------|--------------|-----------|--------------|-------------|--------------|
| Site A   | Cleaning     | Monthly   | 2            | Tuesday     | 2024-03-12   |
```

**New Fields:**

- `Week Pattern`: Which week of the month (1, 2, 3, 4, or "Last")
- `Day of Week`: Monday through Friday

**Note:** "Every 4 Weeks" could remain as a separate frequency for services that truly need fixed intervals and don't have the one-per-month billing constraint.

---

## Scheduling Logic

### Calculate Next Service Date

```javascript
/**
 * Calculate the Nth weekday of a given month
 * @param {number} year
 * @param {number} month - 0-indexed (0 = January)
 * @param {number|string} weekPattern - 1, 2, 3, 4, or "Last"
 * @param {number} dayOfWeek - 0 = Sunday, 1 = Monday, ..., 5 = Friday
 * @returns {Date}
 */
function getNthWeekdayOfMonth(year, month, weekPattern, dayOfWeek) {
  if (weekPattern === "Last" || weekPattern === "last") {
    // Start from last day of month and work backward
    const lastDay = new Date(year, month + 1, 0);
    let date = lastDay;

    while (date.getDay() !== dayOfWeek) {
      date.setDate(date.getDate() - 1);
    }
    return date;
  }

  // Start from first day of month
  const firstDay = new Date(year, month, 1);
  let date = firstDay;

  // Find first occurrence of target day
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1);
  }

  // Add weeks to get to Nth occurrence
  date.setDate(date.getDate() + (weekPattern - 1) * 7);

  return date;
}

/**
 * Get next monthly service date after a reference date
 * @param {Date} afterDate - Find next occurrence after this date
 * @param {number|string} weekPattern
 * @param {number} dayOfWeek
 * @returns {Date}
 */
function getNextMonthlyServiceDate(afterDate, weekPattern, dayOfWeek) {
  let year = afterDate.getFullYear();
  let month = afterDate.getMonth();

  // Try current month first
  let candidate = getNthWeekdayOfMonth(year, month, weekPattern, dayOfWeek);

  // If candidate is not after our reference date, move to next month
  if (candidate <= afterDate) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    candidate = getNthWeekdayOfMonth(year, month, weekPattern, dayOfWeek);
  }

  return candidate;
}
```

### Day of Week Mapping

```javascript
const DAY_OF_WEEK = {
  "Sunday": 0,    // Typically not used
  "Monday": 1,
  "Tuesday": 2,
  "Wednesday": 3,
  "Thursday": 4,
  "Friday": 5,
  "Saturday": 6   // Typically not used
};
```

---

## Migration Strategy

### Step 1: Analyze Current Services

For each "Every 4 Weeks" service, determine the pattern from recent service history:

```javascript
function derivePatternFromDate(serviceDate) {
  const dayOfWeek = serviceDate.getDay();
  const dayOfMonth = serviceDate.getDate();

  // Determine which week of the month
  let weekPattern;
  if (dayOfMonth <= 7) {
    weekPattern = 1;
  } else if (dayOfMonth <= 14) {
    weekPattern = 2;
  } else if (dayOfMonth <= 21) {
    weekPattern = 3;
  } else if (dayOfMonth <= 28) {
    weekPattern = 4;
  } else {
    weekPattern = "Last";
  }

  return { weekPattern, dayOfWeek };
}
```

### Step 2: Migration Scenarios

| Current State | Migration Action |
|---------------|------------------|
| Service on Tuesday, ~10th of month | Assign "2nd Tuesday" |
| Service on Friday, ~25th of month | Assign "4th Friday" or "Last Friday" |
| Service on Monday, 1st-7th of month | Assign "1st Monday" |

### Step 3: Handle Edge Cases

**5th Week Problem**: Some months have 5 occurrences of a weekday. If a service is assigned "4th Wednesday" but the current date is the 5th Wednesday:
- Option A: Skip to next month's 4th Wednesday (longer gap)
- Option B: Use 5th Wednesday this month (preserves ~monthly cadence)
- **Recommendation**: Option A - prioritize consistency of pattern

**Last Week Ambiguity**: "Last Friday" could be the 4th or 5th Friday depending on month.
- This is actually fine - "Last" means last, and it naturally handles the variation

---

## UI Considerations

### Service Setup Form

Replace frequency dropdown with:

```
Frequency: [Monthly ▼]

When: [2nd ▼] [Tuesday ▼] of each month

Preview: Next 3 services would be:
  - March 11, 2025
  - April 8, 2025
  - May 13, 2025
```

### Validation Rules

- Week pattern must be 1-4 or "Last"
- Day of week must be Monday-Friday (no weekends)
- Warn if "4th [Day]" is selected (some months won't have it - consider "Last" instead)

---

## Backward Compatibility

### Option A: Deprecate "Every 4 Weeks"

- Migrate all existing services to Monthly pattern
- Remove "Every 4 Weeks" as an option
- Simplest long-term

### Option B: Keep Both Frequencies

- "Every 4 Weeks" remains for services without monthly billing constraint
- "Monthly" uses the new pattern-based logic
- More flexible but more code paths

**Recommendation**: Option A unless there are specific services that genuinely need fixed 28-day intervals.

---

## Implementation Checklist

- [ ] Add `weekPattern` and `dayOfWeek` columns to Recurring Services sheet
- [ ] Implement `getNthWeekdayOfMonth()` function
- [ ] Implement `getNextMonthlyServiceDate()` function
- [ ] Update `generateFutureSchedule()` to use new logic for Monthly frequency
- [ ] Create migration script to derive patterns from existing services
- [ ] Update service creation/edit UI
- [ ] Update calendar view generation
- [ ] Test edge cases (5th week, year boundaries, etc.)
- [ ] Document changes for users

---

## Open Questions

1. **Minimum Interval**: Should there be a minimum gap between services (e.g., at least 21 days)? Or does the pattern-based approach make this unnecessary?

2. **Holiday Handling**: If the calculated date falls on a holiday, shift forward or backward? This is orthogonal to the monthly pattern but worth considering.

3. **Manual Overrides**: If a service is manually rescheduled mid-month, does it affect future calculations? Pattern-based scheduling means "no" - next month still follows the pattern.

4. **Other Frequencies**: Do "Every 8 Weeks" or "Quarterly" services have similar issues? Should they become "Every Other Month (2nd Tuesday)" or "Quarterly (1st Monday of Mar/Jun/Sep/Dec)"?
