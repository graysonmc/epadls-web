import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddServiceModal from '../components/services/AddServiceModal';

function ServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const handleRowClick = (serviceId) => {
    navigate(`/services/${serviceId}`);
  };

  const handleAddSuccess = (newService) => {
    // Navigate to the new service detail page
    navigate(`/services/${newService.id}`);
  };

  const filteredServices = services.filter(service => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      service.job_site?.name?.toLowerCase().includes(searchLower) ||
      service.job_site?.address?.toLowerCase().includes(searchLower) ||
      service.job_site?.city?.toLowerCase().includes(searchLower) ||
      service.service_type?.toLowerCase().includes(searchLower) ||
      service.frequency?.toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    loadServices();
  }, [showInactive]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await api.getServices(showInactive ? false : null);
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
        <input
          type="text"
          placeholder="Search by job site, service type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Only inactive
        </label>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>Add New Service</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Service ID</th>
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
            {filteredServices.map(service => (
              <tr
                key={service.id}
                className={`clickable ${!service.is_active ? 'inactive' : ''}`}
                onClick={() => handleRowClick(service.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{service.service_id}</td>
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
                <td>→</td>
              </tr>
            ))}
            {filteredServices.length === 0 && (
              <tr>
                <td colSpan="8" className="no-data">
                  {search ? 'No services match your search' : 'No services found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddServiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}

export default ServicesPage;
