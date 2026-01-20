/**
 * ActionService - Process service actions (completions, cancellations, reschedules)
 * Ported from Code.js TransactionalProcessor
 */

import { supabase } from '../config/database.js';
import { DateService } from './DateService.js';
import { ValidationService } from './ValidationService.js';

export const ActionService = {
  /**
   * Process batch actions with database transaction
   */
  async processActions({ completions, cancellations, reschedules }) {
    // Validate all actions first
    const validation = await ValidationService.validateAllActions({
      completions,
      cancellations,
      reschedules,
    });

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    const results = {
      success: true,
      completions: [],
      cancellations: [],
      reschedules: [],
      errors: [],
      warnings: validation.warnings,
    };

    try {
      // Process completions
      for (const completion of completions) {
        const result = await this.processCompletion(completion);
        if (result.success) {
          results.completions.push(result);
        } else {
          results.errors.push(result.error);
        }
      }

      // Process cancellations
      for (const cancellation of cancellations) {
        const result = await this.processCancellation(cancellation);
        if (result.success) {
          results.cancellations.push(result);
        } else {
          results.errors.push(result.error);
        }
      }

      // Process reschedules
      for (const reschedule of reschedules) {
        const result = await this.processReschedule(reschedule);
        if (result.success) {
          results.reschedules.push(result);
        } else {
          results.errors.push(result.error);
        }
      }

      if (results.errors.length > 0) {
        results.success = false;
      }

      return results;
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
        completions: results.completions,
        cancellations: results.cancellations,
        reschedules: results.reschedules,
      };
    }
  },

  /**
   * Process a single completion
   */
  async processCompletion(completion) {
    const {
      recurring_service_id,
      scheduled_date,
      completion_date,
      notes,
      performed_by = 'Service Manager',
    } = completion;

    try {
      const actualCompletionDate = completion_date || scheduled_date;

      // 1. Create service event
      const { error: eventError } = await supabase
        .from('service_events')
        .insert({
          recurring_service_id,
          scheduled_date,
          event_type: 'completed',
          event_date: DateService.today().toISOString().split('T')[0],
          completed_date: actualCompletionDate,
          performed_by,
          notes,
        });

      if (eventError) throw new Error(eventError.message);

      // 2. Update last_service_date on recurring service
      const { error: updateError } = await supabase
        .from('recurring_services')
        .update({ last_service_date: actualCompletionDate })
        .eq('id', recurring_service_id);

      if (updateError) throw new Error(updateError.message);

      // 3. Check if this service needs manifest tracking
      const { data: service } = await supabase
        .from('recurring_services')
        .select('manifest_county, job_site_id')
        .eq('id', recurring_service_id)
        .single();

      if (service?.manifest_county) {
        // Add manifest entry
        const { error: manifestError } = await supabase
          .from('manifest_entries')
          .insert({
            recurring_service_id,
            job_site_id: service.job_site_id,
            date_completed: actualCompletionDate,
            quarter: DateService.calculateQuarter(actualCompletionDate),
            county: service.manifest_county,
          });

        if (manifestError) {
          console.error('Failed to create manifest entry:', manifestError);
        }
      }

      return { success: true, recurring_service_id, scheduled_date };
    } catch (error) {
      return { success: false, error: error.message, recurring_service_id };
    }
  },

  /**
   * Process a single cancellation
   */
  async processCancellation(cancellation) {
    const {
      recurring_service_id,
      scheduled_date,
      notes,
      performed_by = 'Service Manager',
    } = cancellation;

    try {
      // Create service event
      const { error: eventError } = await supabase
        .from('service_events')
        .insert({
          recurring_service_id,
          scheduled_date,
          event_type: 'cancelled',
          event_date: DateService.today().toISOString().split('T')[0],
          performed_by,
          notes,
        });

      if (eventError) throw new Error(eventError.message);

      return { success: true, recurring_service_id, scheduled_date };
    } catch (error) {
      return { success: false, error: error.message, recurring_service_id };
    }
  },

  /**
   * Process a single reschedule
   */
  async processReschedule(reschedule) {
    const {
      recurring_service_id,
      scheduled_date,
      new_date,
      notes,
      performed_by = 'Service Manager',
    } = reschedule;

    try {
      // Create service event
      const { error: eventError } = await supabase
        .from('service_events')
        .insert({
          recurring_service_id,
          scheduled_date,
          event_type: 'rescheduled',
          event_date: DateService.today().toISOString().split('T')[0],
          rescheduled_to: new_date,
          performed_by,
          notes,
        });

      if (eventError) throw new Error(eventError.message);

      return { success: true, recurring_service_id, scheduled_date, new_date };
    } catch (error) {
      return { success: false, error: error.message, recurring_service_id };
    }
  },
};
