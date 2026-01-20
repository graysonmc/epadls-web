/**
 * ValidationService - Business rule validation
 * Ported from Code.js ServiceOrderValidator
 */

import { supabase } from '../config/database.js';
import { DateService } from './DateService.js';

export const ValidationService = {
  /**
   * Validate all actions before processing
   */
  async validateAllActions({ completions, cancellations, reschedules }) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Combine completions and cancellations for order validation
    const serviceActions = [...completions, ...cancellations];

    if (serviceActions.length > 0) {
      const orderValidation = await this.validateServiceOrder(serviceActions);
      if (!orderValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...orderValidation.errors);
      }
    }

    if (reschedules.length > 0) {
      const rescheduleValidation = this.validateReschedules(reschedules);
      if (!rescheduleValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...rescheduleValidation.errors);
      }
      validation.warnings.push(...rescheduleValidation.warnings);
    }

    return validation;
  },

  /**
   * Validate that services are processed in chronological order
   * Prevents completing a newer instance before an older one
   */
  async validateServiceOrder(actions) {
    const validation = { isValid: true, errors: [] };

    // Group actions by recurring_service_id
    const actionsByService = new Map();
    for (const action of actions) {
      const serviceId = action.recurring_service_id;
      if (!actionsByService.has(serviceId)) {
        actionsByService.set(serviceId, []);
      }
      actionsByService.get(serviceId).push(action);
    }

    // For each service, check if there are older pending instances
    for (const [serviceId, serviceActions] of actionsByService) {
      // Get the earliest action date being processed
      const actionDates = serviceActions.map(a => new Date(a.scheduled_date));
      const earliestActionDate = new Date(Math.min(...actionDates));

      // Check for existing service events
      const { data: existingEvents } = await supabase
        .from('service_events')
        .select('scheduled_date, event_type')
        .eq('recurring_service_id', serviceId)
        .order('scheduled_date', { ascending: false })
        .limit(10);

      // Get the service to check for older pending instances
      const { data: service } = await supabase
        .from('recurring_services')
        .select('last_service_date, frequency, job_site:job_sites(name)')
        .eq('id', serviceId)
        .single();

      if (service?.last_service_date) {
        // Calculate what dates should exist between last_service_date and earliestActionDate
        let checkDate = DateService.normalize(service.last_service_date);
        const pendingOlder = [];

        while (checkDate < earliestActionDate) {
          const nextDate = DateService.calculateNextServiceDate(
            checkDate,
            service.frequency
          );

          if (!nextDate || nextDate >= earliestActionDate) break;

          // Check if this date has been processed
          const dateStr = nextDate.toISOString().split('T')[0];
          const isProcessed = existingEvents?.some(
            e => e.scheduled_date === dateStr
          );

          if (!isProcessed) {
            pendingOlder.push(nextDate);
          }

          checkDate = nextDate;
        }

        if (pendingOlder.length > 0) {
          validation.isValid = false;
          const siteName = service.job_site?.name || 'Unknown';
          validation.errors.push(
            `${siteName}: Cannot process service for ${DateService.format(earliestActionDate)} ` +
            `while older instances are pending (${pendingOlder.map(d => DateService.format(d)).join(', ')})`
          );
        }
      }
    }

    return validation;
  },

  /**
   * Validate reschedule operations
   */
  validateReschedules(reschedules) {
    const validation = { isValid: true, errors: [], warnings: [] };

    for (const reschedule of reschedules) {
      const { scheduled_date, new_date } = reschedule;

      if (!new_date) {
        validation.isValid = false;
        validation.errors.push('Reschedule requires a new date');
        continue;
      }

      const originalDate = DateService.normalize(scheduled_date);
      const newDate = DateService.normalize(new_date);

      if (!newDate) {
        validation.isValid = false;
        validation.errors.push(`Invalid new date: ${new_date}`);
        continue;
      }

      // Warning if rescheduling to a past date
      if (newDate < DateService.today()) {
        validation.warnings.push(
          `Rescheduling to a past date: ${DateService.format(newDate)}`
        );
      }

      // Warning if rescheduling far into the future
      const daysDiff = Math.abs(
        (newDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 90) {
        validation.warnings.push(
          `Large reschedule: moving ${Math.round(daysDiff)} days from original date`
        );
      }
    }

    return validation;
  },
};
