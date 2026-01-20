/**
 * ScheduleService - Calculate upcoming services dynamically
 * No pre-generation needed - calculates on-the-fly
 */

import { supabase } from '../config/database.js';
import { DateService } from './DateService.js';

export const ScheduleService = {
  /**
   * Get all upcoming services within a date range
   * This replaces the old "Future Schedule" sheet generation
   */
  async getUpcomingServices(startDate, endDate) {
    // Get all active recurring services with their job site info
    const { data: services, error } = await supabase
      .from('recurring_services')
      .select(`
        id,
        job_site_id,
        service_type,
        frequency,
        last_service_date,
        day_constraint,
        time_constraint,
        priority,
        notes,
        manifest_county,
        job_site:job_sites(id, name, address, city, county)
      `)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch services: ${error.message}`);
    }

    // Get existing reschedules that might affect our calculations
    const { data: reschedules } = await supabase
      .from('service_events')
      .select('recurring_service_id, scheduled_date, rescheduled_to')
      .eq('event_type', 'rescheduled')
      .gte('rescheduled_to', startDate.toISOString().split('T')[0])
      .lte('rescheduled_to', endDate.toISOString().split('T')[0]);

    // Build a map of rescheduled services
    const rescheduleMap = new Map();
    (reschedules || []).forEach(r => {
      const key = `${r.recurring_service_id}-${r.scheduled_date}`;
      rescheduleMap.set(key, r.rescheduled_to);
    });

    // Get completed/cancelled events to exclude from schedule
    const { data: processedEvents } = await supabase
      .from('service_events')
      .select('recurring_service_id, scheduled_date, event_type')
      .in('event_type', ['completed', 'cancelled']);

    const processedSet = new Set(
      (processedEvents || []).map(e => `${e.recurring_service_id}-${e.scheduled_date}`)
    );

    // Calculate upcoming dates for each service
    const upcomingServices = [];
    const today = DateService.today();

    for (const service of services) {
      if (!service.last_service_date || !service.frequency) continue;

      const dates = this.calculateUpcomingDates(
        service,
        startDate,
        endDate
      );

      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const eventKey = `${service.id}-${dateStr}`;

        // Skip if already completed or cancelled
        if (processedSet.has(eventKey)) continue;

        // Check if rescheduled
        const rescheduledTo = rescheduleMap.get(eventKey);
        const scheduledDate = rescheduledTo ? new Date(rescheduledTo) : date;

        upcomingServices.push({
          recurring_service_id: service.id,
          job_site_id: service.job_site_id,
          job_site_name: service.job_site?.name || '',
          address: service.job_site?.address || '',
          city: service.job_site?.city || '',
          county: service.job_site?.county || '',
          service_type: service.service_type,
          frequency: service.frequency,
          scheduled_date: scheduledDate,
          original_date: date,
          is_rescheduled: !!rescheduledTo,
          days_overdue: DateService.daysOverdue(scheduledDate),
          priority: service.priority,
          notes: service.notes,
          time_constraint: service.time_constraint,
          manifest_county: service.manifest_county,
        });
      }
    }

    // Sort by scheduled date, then by priority
    upcomingServices.sort((a, b) => {
      const dateCompare = a.scheduled_date.getTime() - b.scheduled_date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return (b.priority || 0) - (a.priority || 0);
    });

    return upcomingServices;
  },

  /**
   * Calculate all upcoming dates for a single recurring service
   */
  calculateUpcomingDates(service, startDate, endDate) {
    const dates = [];
    let currentDate = DateService.normalize(service.last_service_date);

    if (!currentDate) return dates;

    // Calculate forward from last service date
    while (currentDate <= endDate) {
      const nextDate = DateService.calculateNextServiceDate(
        currentDate,
        service.frequency,
        service.day_constraint
      );

      if (!nextDate || nextDate > endDate) break;

      // Include if within range (including overdue - before startDate but after last_service_date)
      if (nextDate >= startDate || nextDate < DateService.today()) {
        dates.push(nextDate);
      }

      currentDate = nextDate;
    }

    return dates;
  },
};
