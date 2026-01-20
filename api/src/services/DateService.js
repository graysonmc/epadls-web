/**
 * DateService - Centralized date handling
 * Ported from Code.js DateManager
 */

const FREQUENCY_DAYS = {
  'weekly': 7,
  'Every 2 weeks': 14,
  'Every 4 weeks': 28,
  'Every 8 weeks': 56,
  'Every 3 months': 90,
  'Every 4 months': 120,
  'Every 6 months': 180,
  'Annually': 365,
};

export const DateService = {
  /**
   * Normalize a date to midnight UTC
   */
  normalize(date) {
    if (!date) return null;

    let d;
    if (date instanceof Date && !isNaN(date)) {
      d = new Date(date);
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else {
      return null;
    }

    if (isNaN(d.getTime())) return null;

    // Set to midnight
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * Get today's date normalized to midnight
   */
  today() {
    return this.normalize(new Date());
  },

  /**
   * Get the number of days for a frequency
   */
  getFrequencyDays(frequency) {
    return FREQUENCY_DAYS[frequency] || null;
  },

  /**
   * Get all valid frequency options
   */
  getFrequencyOptions() {
    return Object.keys(FREQUENCY_DAYS);
  },

  /**
   * Convert day name to number (0=Sunday, 1=Monday, etc.)
   */
  getDayNumber(dayName) {
    if (!dayName || typeof dayName !== 'string') return -1;

    const days = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
    };

    return days[dayName.toLowerCase().trim()] ?? -1;
  },

  /**
   * Avoid weekends: Saturday moves to Friday, Sunday moves to Monday
   */
  avoidWeekends(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 6) {
      // Saturday -> Friday
      d.setDate(d.getDate() - 1);
    } else if (dayOfWeek === 0) {
      // Sunday -> Monday
      d.setDate(d.getDate() + 1);
    }

    return d;
  },

  /**
   * Calculate the next service date from a last service date
   */
  calculateNextServiceDate(lastDate, frequency, dayConstraint = null) {
    const baseDate = this.normalize(lastDate);
    const daysToAdd = FREQUENCY_DAYS[frequency];

    if (!baseDate || !daysToAdd) return null;

    let nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd);

    // Apply day constraint if specified
    if (dayConstraint) {
      const targetDay = this.getDayNumber(dayConstraint);
      if (targetDay !== -1) {
        // Move forward to the next occurrence of the target day
        while (nextDate.getDay() !== targetDay) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }
    }

    // Avoid weekends (unless day constraint specifically targets a weekend)
    if (!dayConstraint) {
      nextDate = this.avoidWeekends(nextDate);
    }

    return nextDate;
  },

  /**
   * Calculate the quarter string from a date (e.g., "Q1 2025")
   */
  calculateQuarter(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = d.getMonth(); // 0-11
    const year = d.getFullYear();
    const quarter = Math.floor(month / 3) + 1;
    return `Q${quarter} ${year}`;
  },

  /**
   * Format a date for display
   */
  format(date, options = {}) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...options,
    });
  },

  /**
   * Calculate days overdue (negative if in future)
   */
  daysOverdue(scheduledDate) {
    const scheduled = this.normalize(scheduledDate);
    const today = this.today();

    if (!scheduled) return 0;

    const diffTime = today.getTime() - scheduled.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  },
};
