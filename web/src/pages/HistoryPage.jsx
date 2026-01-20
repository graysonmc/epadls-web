import { useState, useEffect } from 'react';
import api from '../services/api';

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    eventType: '',
    limit: 100,
  });

  useEffect(() => {
    loadHistory();
  }, [filters]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getHistory(filters);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeLabel = (type) => {
    const labels = {
      completed: 'Completed',
      cancelled: 'Cancelled',
      rescheduled: 'Rescheduled',
    };
    return labels[type] || type;
  };

  const getEventTypeClass = (type) => {
    const classes = {
      completed: 'success',
      cancelled: 'danger',
      rescheduled: 'warning',
    };
    return classes[type] || '';
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <h1>Action History</h1>
        <p>View past service actions</p>
      </div>

      <div className="toolbar">
        <select
          value={filters.eventType}
          onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>

        <select
          value={filters.limit}
          onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
        >
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
          <option value="250">Last 250</option>
        </select>
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
              <th>Scheduled Date</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.map(event => (
              <tr key={event.id}>
                <td>{new Date(event.event_date).toLocaleDateString()}</td>
                <td>{event.recurring_service?.job_site?.name || 'N/A'}</td>
                <td>{event.recurring_service?.service_type || 'N/A'}</td>
                <td>{event.scheduled_date}</td>
                <td>
                  <span className={`status-badge ${getEventTypeClass(event.event_type)}`}>
                    {getEventTypeLabel(event.event_type)}
                  </span>
                  {event.event_type === 'rescheduled' && event.rescheduled_to && (
                    <span className="reschedule-to"> → {event.rescheduled_to}</span>
                  )}
                </td>
                <td>{event.performed_by || 'N/A'}</td>
                <td>{event.notes || '-'}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" className="no-data">No history found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default HistoryPage;
