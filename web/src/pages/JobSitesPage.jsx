import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddJobSiteModal from '../components/job-sites/AddJobSiteModal';

function JobSitesPage() {
  const navigate = useNavigate();
  const [jobSites, setJobSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleRowClick = (siteId) => {
    navigate(`/job-sites/${siteId}`);
  };

  const handleAddSuccess = (newSite) => {
    setJobSites(prev => [newSite, ...prev]);
    // Optionally navigate to the new site
    navigate(`/job-sites/${newSite.id}`);
  };

  useEffect(() => {
    loadJobSites();
  }, []);

  const loadJobSites = async () => {
    try {
      setLoading(true);
      const data = await api.getJobSites();
      setJobSites(data);
    } catch (error) {
      console.error('Failed to load job sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSites = jobSites.filter(site => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      site.name?.toLowerCase().includes(searchLower) ||
      site.address?.toLowerCase().includes(searchLower) ||
      site.city?.toLowerCase().includes(searchLower) ||
      site.county?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="job-sites-page">
      <div className="page-header">
        <h1>Job Sites</h1>
        <p>Manage your service locations</p>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by name, address, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>Add Job Site</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              <th>County</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.map(site => (
              <tr
                key={site.id}
                className="clickable"
                onClick={() => handleRowClick(site.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{site.name}</td>
                <td>{site.address}</td>
                <td>{site.city}</td>
                <td>{site.county}</td>
                <td>→</td>
              </tr>
            ))}
            {filteredSites.length === 0 && (
              <tr>
                <td colSpan="5" className="no-data">
                  {search ? 'No job sites match your search' : 'No job sites found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddJobSiteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}

export default JobSitesPage;
