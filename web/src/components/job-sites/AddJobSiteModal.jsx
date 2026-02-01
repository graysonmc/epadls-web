import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import api from '../../services/api';

function AddJobSiteModal({ isOpen, onClose, onSuccess, editingSite = null }) {
  const isEditing = !!editingSite;

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    county: '',
    zip_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && editingSite) {
      setFormData({
        name: editingSite.name || '',
        address: editingSite.address || '',
        city: editingSite.city || '',
        county: editingSite.county || '',
        zip_code: editingSite.zip_code || '',
      });
    } else if (isOpen && !editingSite) {
      setFormData({
        name: '',
        address: '',
        city: '',
        county: '',
        zip_code: '',
      });
    }
  }, [isOpen, editingSite]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let result;
      if (isEditing) {
        result = await api.updateJobSite(editingSite.id, formData);
      } else {
        result = await api.createJobSite(formData);
      }

      onSuccess(result);
      handleClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} job site`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      county: '',
      zip_code: '',
    });
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditing ? 'Edit Job Site' : 'Add Job Site'}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label>
            Name <span className="required">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., ABC Company"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="e.g., 123 Main Street"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g., Springfield"
            />
          </div>
          <div className="form-group">
            <label>Zip Code</label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              placeholder="e.g., 12345"
            />
          </div>
        </div>

        <div className="form-group">
          <label>County</label>
          <input
            type="text"
            name="county"
            value={formData.county}
            onChange={handleChange}
            placeholder="e.g., Greene"
          />
          <div className="help-text">Used for manifest reporting</div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Job Site')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddJobSiteModal;
