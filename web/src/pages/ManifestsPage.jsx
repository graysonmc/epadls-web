import { useState, useEffect } from 'react';
import api from '../services/api';

function ManifestsPage() {
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    quarter: '',
    county: '',
  });

  const currentYear = new Date().getFullYear();
  const quarters = [
    `Q1 ${currentYear}`,
    `Q2 ${currentYear}`,
    `Q3 ${currentYear}`,
    `Q4 ${currentYear}`,
    `Q1 ${currentYear - 1}`,
    `Q2 ${currentYear - 1}`,
    `Q3 ${currentYear - 1}`,
    `Q4 ${currentYear - 1}`,
  ];

  const loadManifests = async () => {
    if (!filters.quarter && !filters.county) {
      return;
    }

    try {
      setLoading(true);
      const data = await api.getManifests(filters.quarter, filters.county);
      setManifests(data);
    } catch (error) {
      console.error('Failed to load manifests:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!filters.quarter || !filters.county) {
      alert('Please select both quarter and county to export');
      return;
    }

    try {
      const blob = await api.exportManifest(filters.quarter, filters.county);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manifest-${filters.quarter}-${filters.county}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert('Failed to export: ' + error.message);
    }
  };

  return (
    <div className="manifests-page">
      <div className="page-header">
        <h1>Manifest Reports</h1>
        <p>Generate compliance manifests by quarter and county</p>
      </div>

      <div className="toolbar">
        <select
          value={filters.quarter}
          onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
        >
          <option value="">Select Quarter</option>
          {quarters.map(q => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Enter county..."
          value={filters.county}
          onChange={(e) => setFilters({ ...filters, county: e.target.value })}
        />

        <button onClick={loadManifests} className="btn-primary">
          Generate Report
        </button>

        <button onClick={exportCSV} disabled={manifests.length === 0}>
          Export CSV
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : manifests.length > 0 ? (
        <>
          <div className="report-summary">
            <strong>{manifests.length}</strong> records found for {filters.county} - {filters.quarter}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date Completed</th>
                <th>Job Site</th>
                <th>Address</th>
                <th>Service Type</th>
              </tr>
            </thead>
            <tbody>
              {manifests.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.date_completed}</td>
                  <td>{entry.job_site?.name || 'N/A'}</td>
                  <td>{entry.job_site?.address || 'N/A'}</td>
                  <td>{entry.recurring_service?.service_type || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="no-data">Select a quarter and county to generate a report</p>
      )}
    </div>
  );
}

export default ManifestsPage;
