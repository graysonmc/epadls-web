import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import api from '../../services/api';

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

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];


function AddServiceModal({ isOpen, onClose, onSuccess, preselectedJobSite = null, editingService = null }) {
  const isEditing = !!editingService;

  const [jobSites, setJobSites] = useState([]);
  const [loadingJobSites, setLoadingJobSites] = useState(true);
  const [formData, setFormData] = useState({
    job_site_id: '',
    service_type: '',
    frequency: '',
    day_constraint: '',
    time_constraint: '',
    priority: '0',
    notes: '',
    office_notes: '',
    manifest_county: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadJobSites();

      if (editingService) {
        // Editing existing service
        setFormData({
          job_site_id: editingService.job_site_id || '',
          service_type: editingService.service_type || '',
          frequency: editingService.frequency || '',
          day_constraint: editingService.day_constraint || '',
          time_constraint: editingService.time_constraint || '',
          priority: String(editingService.priority || 0),
          notes: editingService.notes || '',
          office_notes: editingService.office_notes || '',
          manifest_county: editingService.manifest_county || '',
        });
      } else if (preselectedJobSite) {
        // Adding new service with preselected job site
        setFormData(prev => ({
          ...prev,
          job_site_id: preselectedJobSite.id,
          manifest_county: preselectedJobSite.county || '',
        }));
      } else {
        // Adding new service from scratch
        setFormData({
          job_site_id: '',
          service_type: '',
          frequency: '',
          day_constraint: '',
          time_constraint: '',
          priority: '0',
          notes: '',
          office_notes: '',
          manifest_county: '',
        });
      }
    }
  }, [isOpen, preselectedJobSite, editingService]);

  const loadJobSites = async () => {
    try {
      setLoadingJobSites(true);
      const sites = await api.getJobSites();
      setJobSites(sites);
    } catch (err) {
      console.error('Failed to load job sites:', err);
    } finally {
      setLoadingJobSites(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');

    // Auto-fill manifest county when job site changes
    if (name === 'job_site_id') {
      const selectedSite = jobSites.find(s => s.id === value);
      if (selectedSite?.county) {
        setFormData(prev => ({ ...prev, manifest_county: selectedSite.county }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.job_site_id) {
      setError('Job site is required');
      return;
    }
    if (!formData.service_type) {
      setError('Service type is required');
      return;
    }
    if (!formData.frequency) {
      setError('Frequency is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        ...formData,
        priority: parseInt(formData.priority) || 0,
        day_constraint: formData.day_constraint || null,
        time_constraint: formData.time_constraint || null,
        notes: formData.notes || null,
        office_notes: formData.office_notes || null,
        manifest_county: formData.manifest_county || null,
      };

      let result;
      if (isEditing) {
        result = await api.updateService(editingService.id, payload);
      } else {
        result = await api.createService(payload);
      }

      onSuccess(result);
      handleClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} service`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      job_site_id: '',
      service_type: '',
      frequency: '',
      day_constraint: '',
      time_constraint: '',
      priority: '0',
      notes: '',
      office_notes: '',
      manifest_county: '',
    });
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditing ? 'Edit Service' : 'Add New Service'}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label>
            Job Site <span className="required">*</span>
          </label>
          {loadingJobSites ? (
            <select disabled>
              <option>Loading job sites...</option>
            </select>
          ) : (
            <select
              name="job_site_id"
              value={formData.job_site_id}
              onChange={handleChange}
              disabled={!!preselectedJobSite || isEditing}
            >
              <option value="">Select a job site...</option>
              {jobSites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name} {site.city ? `(${site.city})` : ''}
                </option>
              ))}
            </select>
          )}
          {jobSites.length === 0 && !loadingJobSites && (
            <div className="help-text">No job sites found. Create a job site first.</div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Service Type <span className="required">*</span>
            </label>
            <input
              type="text"
              name="service_type"
              value={formData.service_type}
              onChange={handleChange}
              placeholder="e.g., Pumping, Cleaning, Inspection"
            />
          </div>
          <div className="form-group">
            <label>
              Frequency <span className="required">*</span>
            </label>
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
            >
              <option value="">Select frequency...</option>
              {FREQUENCIES.map(freq => (
                <option key={freq} value={freq}>{freq}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Day Constraint</label>
            <select
              name="day_constraint"
              value={formData.day_constraint}
              onChange={handleChange}
            >
              <option value="">Any day</option>
              {DAYS_OF_WEEK.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <div className="help-text">Restrict service to specific day</div>
          </div>
          <div className="form-group">
            <label>Time Constraint</label>
            <input
              type="text"
              name="time_constraint"
              value={formData.time_constraint}
              onChange={handleChange}
              placeholder="e.g., AM, PM, First Stop"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Priority</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="0">Normal</option>
              <option value="1">High</option>
              <option value="2">Urgent</option>
            </select>
          </div>
          <div className="form-group">
            <label>Manifest County</label>
            <input
              type="text"
              name="manifest_county"
              value={formData.manifest_county}
              onChange={handleChange}
              placeholder="e.g., Greene"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Field Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Notes for field technicians..."
          />
        </div>

        <div className="form-group">
          <label>Office Notes</label>
          <textarea
            name="office_notes"
            value={formData.office_notes}
            onChange={handleChange}
            placeholder="Internal office notes..."
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || jobSites.length === 0}
          >
            {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Service')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddServiceModal;
