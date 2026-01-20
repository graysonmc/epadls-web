import { useState, useEffect } from 'react';
import api from '../services/api';

function JobSitesPage() {
  const [jobSites, setJobSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadJobSites();
  }, []);

  const loadJobSites = async (searchTerm = '') => {
    try {
      setLoading(true);
      const data = await api.getJobSites(searchTerm);
      setJobSites(data);
    } catch (error) {
      console.error('Failed to load job sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadJobSites(search);
  };

  return (
    <div className="job-sites-page">
      <div className="page-header">
        <h1>Job Sites</h1>
        <p>Manage your service locations</p>
      </div>

      <div className="toolbar">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search job sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <button className="btn-primary">Add Job Site</button>
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
            {jobSites.map(site => (
              <tr key={site.id}>
                <td>{site.name}</td>
                <td>{site.address}</td>
                <td>{site.city}</td>
                <td>{site.county}</td>
                <td>
                  <button className="btn-sm">Edit</button>
                </td>
              </tr>
            ))}
            {jobSites.length === 0 && (
              <tr>
                <td colSpan="5" className="no-data">No job sites found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default JobSitesPage;
