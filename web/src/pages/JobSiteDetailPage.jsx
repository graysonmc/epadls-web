import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddServiceModal from '../components/services/AddServiceModal';
import AddJobSiteModal from '../components/job-sites/AddJobSiteModal';
import './DetailPage.css';

function JobSiteDetailPage() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [services, setServices] = useState([]);
  const [history, setHistory] = useState({ events: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadSite();
    loadServices();
    loadHistory();
  }, [siteId]);

  const loadSite = async () => {
    try {
      setLoading(true);
      const data = await api.getJobSite(siteId);
      setSite(data);
    } catch (error) {
      console.error('Failed to load site:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const data = await api.getJobSiteServices(siteId);
      setServices(data);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const loadHistory = async (offset = 0) => {
    try {
      setHistoryLoading(true);
      const data = await api.getJobSiteHistory(siteId, 20, offset);
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

  const handleAddServiceSuccess = (newService) => {
    navigate(`/services/${newService.id}`);
  };

  const handleEditSuccess = (updatedSite) => {
    setSite(updatedSite);
    setShowEditModal(false);
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
    return <div className="loading">Loading site...</div>;
  }

  if (!site) {
    return <div className="error">Job site not found</div>;
  }

  return (
    <div className="detail-page">
      <div className="back-link">
        <Link to="/job-sites">← Back to Job Sites</Link>
      </div>

      <div className="page-header">
        <h1>{site.name}</h1>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <div className="card-header-with-action">
            <h2>Site Details</h2>
            <button
              className="btn-sm"
              onClick={() => setShowEditModal(true)}
            >
              Edit
            </button>
          </div>
          <div className="detail-content">
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{site.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Address</span>
              <span className="detail-value">{site.address || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">City</span>
              <span className="detail-value">{site.city || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">County</span>
              <span className="detail-value">{site.county || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Zip Code</span>
              <span className="detail-value">{site.zip_code || '-'}</span>
            </div>
          </div>
        </div>

        <div className="detail-card">
          <div className="card-header-with-action">
            <h2>Services at This Site</h2>
            <button
              className="btn-sm btn-primary"
              onClick={() => setShowAddServiceModal(true)}
            >
              + Add Service
            </button>
          </div>
          {services.length === 0 ? (
            <p className="no-data">No services configured</p>
          ) : (
            <div className="services-list">
              {services.map(service => (
                <Link
                  key={service.id}
                  to={`/services/${service.id}`}
                  className={`service-item ${!service.is_active ? 'inactive' : ''}`}
                >
                  <div className="service-item-main">
                    <span className="service-type">{service.service_type}</span>
                    <span className="service-frequency">{service.frequency}</span>
                  </div>
                  <div className="service-item-meta">
                    <span className={`status-badge ${service.is_active ? 'active' : 'inactive'}`}>
                      {service.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="service-arrow">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-card full-width">
        <h2>Site History</h2>
        {history.events.length === 0 ? (
          <p className="no-data">No history available</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Event</th>
                  <th>Details</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {history.events.map(event => (
                  <tr key={event.id}>
                    <td>{formatDate(event.event_date)}</td>
                    <td>{event.service_type}</td>
                    <td>
                      <span className={`status-badge ${getEventTypeClass(event.event_type)}`}>
                        {getEventTypeLabel(event.event_type)}
                      </span>
                    </td>
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

      <AddServiceModal
        isOpen={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        onSuccess={handleAddServiceSuccess}
        preselectedJobSite={site}
      />

      <AddJobSiteModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        editingSite={site}
      />
    </div>
  );
}

export default JobSiteDetailPage;
