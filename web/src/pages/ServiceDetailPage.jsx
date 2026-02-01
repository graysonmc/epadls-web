import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './DetailPage.css';

const FREQUENCIES = [
  'Weekly',
  'Every 2 Weeks',
  'Every 4 Weeks',
  'Every 6 Weeks',
  'Every 8 Weeks',
  'Every 12 Weeks',
  'Quarterly',
  'Semi-Annual',
  'Annual',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function ServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [history, setHistory] = useState({ events: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadService();
    loadHistory();
  }, [serviceId]);

  const loadService = async () => {
    try {
      setLoading(true);
      const data = await api.getService(serviceId);
      setService(data);
    } catch (error) {
      console.error('Failed to load service:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (offset = 0) => {
    try {
      setHistoryLoading(true);
      const data = await api.getServiceHistory(serviceId, 20, offset);
      if (offset === 0) {
        setHistory(data);
      } else {
        setHistory(prev => ({
          ...data,
          events: [...prev.events, ...data.events],
        }));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadHistory(history.events.length);
  };

  const handleStartEdit = () => {
    setEditForm({
      service_type: service.service_type || '',
      frequency: service.frequency || '',
      day_constraint: service.day_constraint || '',
      time_constraint: service.time_constraint || '',
      priority: String(service.priority || 0),
      notes: service.notes || '',
      office_notes: service.office_notes || '',
      manifest_county: service.manifest_county || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const payload = {
        ...editForm,
        priority: parseInt(editForm.priority) || 0,
        day_constraint: editForm.day_constraint || null,
        time_constraint: editForm.time_constraint || null,
        notes: editForm.notes || null,
        office_notes: editForm.office_notes || null,
        manifest_county: editForm.manifest_county || null,
      };
      const updated = await api.updateService(serviceId, payload);
      setService(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save service:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePause = async () => {
    if (!confirm('Are you sure you want to pause this service? It can be resumed later.')) return;
    try {
      setActionLoading(true);
      await api.updateService(serviceId, { is_active: false });
      loadService();
    } catch (error) {
      console.error('Failed to pause service:', error);
      alert('Failed to pause service');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await api.updateService(serviceId, { is_active: true });
      loadService();
    } catch (error) {
      console.error('Failed to resume service:', error);
      alert('Failed to resume service');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this service? This will permanently deactivate it.')) return;
    try {
      setActionLoading(true);
      await api.deleteService(serviceId);
      navigate('/services');
    } catch (error) {
      console.error('Failed to cancel service:', error);
      alert('Failed to cancel service');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  if (loading) {
    return <div className="loading">Loading service...</div>;
  }

  if (!service) {
    return <div className="error">Service not found</div>;
  }

  return (
    <div className="detail-page">
      <div className="back-link">
        <Link to="/services">← Back to Services</Link>
      </div>

      <div className="page-header">
        <h1>{service.job_site?.name} - {service.service_type}</h1>
        <span className={`status-badge ${service.is_active ? 'active' : 'inactive'}`}>
          {service.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <div className="card-header">
            <h2>Service Details</h2>
            {!isEditing ? (
              <button className="btn-sm" onClick={handleStartEdit}>Edit</button>
            ) : (
              <div className="edit-actions">
                <button className="btn-sm" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                <button className="btn-sm btn-primary" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
          <div className="detail-content">
            <div className="detail-row">
              <span className="detail-label">Job Site</span>
              <span className="detail-value">
                <Link to={`/job-sites/${service.job_site?.id}`}>
                  {service.job_site?.name}
                </Link>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Service Type</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.service_type}
                  onChange={(e) => handleEditChange('service_type', e.target.value)}
                  className="edit-input"
                />
              ) : (
                <span className="detail-value">{service.service_type}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Frequency</span>
              {isEditing ? (
                <select
                  value={editForm.frequency}
                  onChange={(e) => handleEditChange('frequency', e.target.value)}
                  className="edit-input"
                >
                  <option value="">Select...</option>
                  {FREQUENCIES.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              ) : (
                <span className="detail-value">{service.frequency}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Day Constraint</span>
              {isEditing ? (
                <select
                  value={editForm.day_constraint}
                  onChange={(e) => handleEditChange('day_constraint', e.target.value)}
                  className="edit-input"
                >
                  <option value="">Any day</option>
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              ) : (
                <span className="detail-value">{service.day_constraint || 'Any'}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Time Constraint</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.time_constraint}
                  onChange={(e) => handleEditChange('time_constraint', e.target.value)}
                  className="edit-input"
                  placeholder="e.g., AM, PM, First Stop"
                />
              ) : (
                <span className="detail-value">{service.time_constraint || 'None'}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Service</span>
              <span className="detail-value">{formatDate(service.last_service_date)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Priority</span>
              {isEditing ? (
                <select
                  value={editForm.priority}
                  onChange={(e) => handleEditChange('priority', e.target.value)}
                  className="edit-input"
                >
                  <option value="0">Normal</option>
                  <option value="1">High</option>
                  <option value="2">Urgent</option>
                </select>
              ) : (
                <span className="detail-value">
                  {service.priority === 2 ? 'Urgent' : service.priority === 1 ? 'High' : 'Normal'}
                </span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Field Notes</span>
              {isEditing ? (
                <textarea
                  value={editForm.notes}
                  onChange={(e) => handleEditChange('notes', e.target.value)}
                  className="edit-input"
                  rows={3}
                />
              ) : (
                <span className="detail-value">{service.notes || 'None'}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Office Notes</span>
              {isEditing ? (
                <textarea
                  value={editForm.office_notes}
                  onChange={(e) => handleEditChange('office_notes', e.target.value)}
                  className="edit-input"
                  rows={3}
                />
              ) : (
                <span className="detail-value">{service.office_notes || 'None'}</span>
              )}
            </div>
            <div className="detail-row">
              <span className="detail-label">Manifest County</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.manifest_county}
                  onChange={(e) => handleEditChange('manifest_county', e.target.value)}
                  className="edit-input"
                />
              ) : (
                <span className="detail-value">{service.manifest_county || 'None'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-card">
          <h2>Actions</h2>
          <div className="actions-content">
            <p className="action-description">
              {service.is_active
                ? 'Pause the service temporarily, or cancel it permanently.'
                : 'Resume to start scheduling this service again.'}
            </p>
            <div className="action-buttons">
              {service.is_active ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={handlePause}
                    disabled={actionLoading}
                  >
                    Pause Service
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    Cancel Service
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleResume}
                  disabled={actionLoading}
                >
                  Resume Service
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-card full-width">
        <h2>Service History</h2>
        {history.events.length === 0 ? (
          <p className="no-data">No history available</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Scheduled For</th>
                  <th>Details</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {history.events.map(event => (
                  <tr key={event.id}>
                    <td>{formatDate(event.event_date)}</td>
                    <td>
                      <span className={`status-badge ${getEventTypeClass(event.event_type)}`}>
                        {getEventTypeLabel(event.event_type)}
                      </span>
                    </td>
                    <td>{formatDate(event.scheduled_date)}</td>
                    <td>
                      {event.event_type === 'rescheduled' && event.rescheduled_to && (
                        <span>→ {formatDate(event.rescheduled_to)}</span>
                      )}
                      {event.notes && <span>{event.notes}</span>}
                    </td>
                    <td>{event.performed_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.events.length < history.total && (
              <div className="load-more">
                <button onClick={handleLoadMore} disabled={historyLoading}>
                  {historyLoading ? 'Loading...' : `Load More (${history.events.length} of ${history.total})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ServiceDetailPage;
