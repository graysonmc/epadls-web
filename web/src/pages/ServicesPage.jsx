import { useState, useEffect } from 'react';
import api from '../services/api';

function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadServices();
  }, [showInactive]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await api.getServices(!showInactive);
      setServices(data);
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="services-page">
      <div className="page-header">
        <h1>Recurring Services</h1>
        <p>Manage your recurring service definitions</p>
      </div>

      <div className="toolbar">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <button className="btn-primary">Add New Service</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Job Site</th>
              <th>Service Type</th>
              <th>Frequency</th>
              <th>Last Service</th>
              <th>Day Constraint</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map(service => (
              <tr key={service.id} className={!service.is_active ? 'inactive' : ''}>
                <td>{service.job_site?.name || 'N/A'}</td>
                <td>{service.service_type}</td>
                <td>{service.frequency}</td>
                <td>{service.last_service_date || 'Never'}</td>
                <td>{service.day_constraint || 'Any'}</td>
                <td>
                  <span className={`status-badge ${service.is_active ? 'active' : 'inactive'}`}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn-sm">Edit</button>
                  <button className="btn-sm btn-danger">
                    {service.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan="7" className="no-data">No services found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ServicesPage;
