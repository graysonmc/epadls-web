import { useState, useEffect } from 'react';
import api from '../services/api';

function SchedulePage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  });
  const [actions, setActions] = useState({});

  useEffect(() => {
    loadSchedule();
  }, [endDate]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await api.getSchedule(null, endDate);
      setServices(data);
      setActions({});
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (serviceKey, action, value) => {
    setActions(prev => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        [action]: value,
        // Clear other actions when one is selected
        ...(action === 'complete' && value ? { cancel: false, reschedule: false } : {}),
        ...(action === 'cancel' && value ? { complete: false, reschedule: false } : {}),
        ...(action === 'reschedule' && value ? { complete: false, cancel: false } : {}),
      },
    }));
  };

  const processActions = async () => {
    const completions = [];
    const cancellations = [];
    const reschedules = [];

    Object.entries(actions).forEach(([key, action]) => {
      const [serviceId, scheduledDate] = key.split('|');

      if (action.complete) {
        completions.push({
          recurring_service_id: serviceId,
          scheduled_date: scheduledDate,
          completion_date: action.newDate || scheduledDate,
        });
      } else if (action.cancel) {
        cancellations.push({
          recurring_service_id: serviceId,
          scheduled_date: scheduledDate,
        });
      } else if (action.reschedule && action.newDate) {
        reschedules.push({
          recurring_service_id: serviceId,
          scheduled_date: scheduledDate,
          new_date: action.newDate,
        });
      }
    });

    if (completions.length === 0 && cancellations.length === 0 && reschedules.length === 0) {
      alert('No actions selected');
      return;
    }

    try {
      const result = await api.processActions({ completions, cancellations, reschedules });
      if (result.success) {
        alert(`Processed: ${completions.length} completions, ${cancellations.length} cancellations, ${reschedules.length} reschedules`);
        loadSchedule();
      } else {
        alert('Errors: ' + result.errors.join('\n'));
      }
    } catch (error) {
      alert('Failed to process actions: ' + error.message);
    }
  };

  return (
    <div className="schedule-page">
      <div className="page-header">
        <h1>Service Manager</h1>
        <p>View and manage scheduled services</p>
      </div>

      <div className="toolbar">
        <label>
          Show services through:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <button className="btn-primary" onClick={processActions}>
          Process Actions
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Job Site</th>
              <th>Service Type</th>
              <th>Days Overdue</th>
              <th>Complete</th>
              <th>Reschedule</th>
              <th>Cancel</th>
              <th>New Date</th>
            </tr>
          </thead>
          <tbody>
            {services.map(service => {
              const key = `${service.recurring_service_id}|${new Date(service.scheduled_date).toISOString().split('T')[0]}`;
              const action = actions[key] || {};

              return (
                <tr
                  key={key}
                  className={service.days_overdue > 0 ? 'overdue' : ''}
                >
                  <td>
                    {new Date(service.scheduled_date).toLocaleDateString()}
                    {service.is_rescheduled && <span className="badge">Rescheduled</span>}
                  </td>
                  <td>{service.job_site_name}</td>
                  <td>{service.service_type}</td>
                  <td className={service.days_overdue > 0 ? 'text-danger' : ''}>
                    {service.days_overdue > 0 ? service.days_overdue : '-'}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={action.complete || false}
                      onChange={(e) => handleActionChange(key, 'complete', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={action.reschedule || false}
                      onChange={(e) => handleActionChange(key, 'reschedule', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={action.cancel || false}
                      onChange={(e) => handleActionChange(key, 'cancel', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={action.newDate || ''}
                      onChange={(e) => handleActionChange(key, 'newDate', e.target.value)}
                      disabled={!action.complete && !action.reschedule}
                    />
                  </td>
                </tr>
              );
            })}
            {services.length === 0 && (
              <tr>
                <td colSpan="8" className="no-data">No scheduled services</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SchedulePage;
