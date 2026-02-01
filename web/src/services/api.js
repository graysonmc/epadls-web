/**
 * API Client for EPADLS Web
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || 'Request failed');
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return null;
    }

    // Handle blob responses (PDF downloads)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/pdf')) {
      return response.blob();
    }

    return response.json();
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.session?.access_token) {
      this.setToken(data.session.access_token);
    }
    return data;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  // Job Sites
  async getJobSites(search = '') {
    const params = search ? `?q=${encodeURIComponent(search)}` : '';
    return this.request(`/api/job-sites${params}`);
  }

  async getJobSite(id) {
    return this.request(`/api/job-sites/${id}`);
  }

  async createJobSite(data) {
    return this.request('/api/job-sites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJobSite(id, data) {
    return this.request(`/api/job-sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJobSite(id) {
    return this.request(`/api/job-sites/${id}`, { method: 'DELETE' });
  }

  // Recurring Services
  async getServices(active = null) {
    const params = active !== null ? `?active=${active}` : '';
    return this.request(`/api/services${params}`);
  }

  async getService(id) {
    return this.request(`/api/services/${id}`);
  }

  async createService(data) {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateService(id, data) {
    return this.request(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteService(id) {
    return this.request(`/api/services/${id}`, { method: 'DELETE' });
  }

  async getServiceHistory(id, limit = 20, offset = 0) {
    return this.request(`/api/services/${id}/history?limit=${limit}&offset=${offset}`);
  }

  async getJobSiteServices(id) {
    return this.request(`/api/job-sites/${id}/services`);
  }

  async getJobSiteHistory(id, limit = 20, offset = 0) {
    return this.request(`/api/job-sites/${id}/history?limit=${limit}&offset=${offset}`);
  }

  // Schedule
  async getSchedule(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return this.request(`/api/schedule?${params}`);
  }

  async processActions(actions) {
    return this.request('/api/schedule/actions', {
      method: 'POST',
      body: JSON.stringify(actions),
    });
  }

  // Calendar
  async getCalendar(year, month) {
    return this.request(`/api/calendar?year=${year}&month=${month}`);
  }

  // History
  async getHistory(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/history?${params}`);
  }

  // Manifests
  async getManifests(quarter, county) {
    const params = new URLSearchParams();
    if (quarter) params.set('quarter', quarter);
    if (county) params.set('county', county);
    return this.request(`/api/manifests?${params}`);
  }

  async exportManifest(quarter, county) {
    const params = new URLSearchParams({ quarter, county });
    const response = await fetch(`${this.baseUrl}/api/manifests/export?${params}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    return response.blob();
  }

  // Tickets
  async generateTickets(services) {
    return this.request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ services }),
    });
  }

  // Technicians
  async getTechnicians() {
    return this.request('/api/technicians');
  }

  async getTechnician(id) {
    return this.request(`/api/technicians/${id}`);
  }

  async createTechnician(data) {
    return this.request('/api/technicians', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTechnician(id, data) {
    return this.request(`/api/technicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTechnician(id) {
    return this.request(`/api/technicians/${id}`, { method: 'DELETE' });
  }

  // Health check
  async healthCheck() {
    return this.request('/api/health');
  }
}

export const api = new ApiClient();
export default api;
