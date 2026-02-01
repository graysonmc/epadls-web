import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/common/Modal';

function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await api.getTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error('Failed to load technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTech(null);
    setFormData({ name: '', phone: '', email: '' });
    setShowModal(true);
  };

  const handleEdit = (tech) => {
    setEditingTech(tech);
    setFormData({ name: tech.name, phone: tech.phone || '', email: tech.email || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingTech) {
        const updated = await api.updateTechnician(editingTech.id, formData);
        setTechnicians(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await api.createTechnician(formData);
        setTechnicians(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save technician:', error);
      alert('Failed to save technician');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tech) => {
    try {
      const updated = await api.updateTechnician(tech.id, { ...tech, is_active: !tech.is_active });
      setTechnicians(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (error) {
      console.error('Failed to update technician:', error);
    }
  };

  return (
    <div className="technicians-page">
      <div className="page-header">
        <h1>Technicians</h1>
        <p>Manage your service technicians</p>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={handleAdd}>Add Technician</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map(tech => (
              <tr key={tech.id} className={!tech.is_active ? 'inactive' : ''}>
                <td>{tech.name}</td>
                <td>{tech.phone || '-'}</td>
                <td>{tech.email || '-'}</td>
                <td>
                  <span className={`status-badge ${tech.is_active ? 'active' : 'inactive'}`}>
                    {tech.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn-sm" onClick={() => handleEdit(tech)}>Edit</button>
                  {' '}
                  <button
                    className={`btn-sm ${tech.is_active ? 'btn-danger' : ''}`}
                    onClick={() => handleToggleActive(tech)}
                  >
                    {tech.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {technicians.length === 0 && (
              <tr>
                <td colSpan="5" className="no-data">No technicians found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTech ? 'Edit Technician' : 'Add Technician'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (editingTech ? 'Save Changes' : 'Add Technician')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TechniciansPage;
