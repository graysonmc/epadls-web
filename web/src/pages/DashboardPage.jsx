import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './DashboardPage.css';

function DashboardPage() {
  const [stats, setStats] = useState({
    overdueCount: 0,
    todayCount: 0,
    weekCount: 0,
    totalSites: 0,
    totalServices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingServices, setUpcomingServices] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const [schedule, jobSites, services] = await Promise.all([
        api.getSchedule(
          new Date(today.getFullYear() - 1, 0, 1).toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        ),
        api.getJobSites(),
        api.getServices(true),
      ]);

      const todayStr = today.toISOString().split('T')[0];

      const overdue = schedule.filter(s => s.days_overdue > 0);
      const todayServices = schedule.filter(s => {
        const dateStr = new Date(s.scheduled_date).toISOString().split('T')[0];
        return dateStr === todayStr;
      });

      setStats({
        overdueCount: overdue.length,
        todayCount: todayServices.length,
        weekCount: schedule.filter(s => s.days_overdue <= 0).length,
        totalSites: jobSites.length,
        totalServices: services.length,
      });

      // Get top 5 upcoming (including overdue)
      setUpcomingServices(schedule.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your service schedule</p>
      </div>

      <div className="stats-grid">
        <div className={`stat-card ${stats.overdueCount > 0 ? 'alert' : ''}`}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.overdueCount}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.todayCount}</div>
            <div className="stat-label">Due Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-value">{stats.weekCount}</div>
            <div className="stat-label">This Week</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSites}</div>
            <div className="stat-label">Job Sites</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalServices}</div>
            <div className="stat-label">Active Services</div>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h2>Upcoming Services</h2>
          <Link to="/schedule" className="view-all">View All →</Link>
        </div>

        <div className="upcoming-list">
          {upcomingServices.length === 0 ? (
            <p className="no-data">No upcoming services</p>
          ) : (
            upcomingServices.map((service, index) => (
              <div
                key={`${service.recurring_service_id}-${index}`}
                className={`upcoming-item ${service.days_overdue > 0 ? 'overdue' : ''}`}
              >
                <div className="upcoming-date">
                  {new Date(service.scheduled_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {service.days_overdue > 0 && (
                    <span className="overdue-badge">{service.days_overdue}d overdue</span>
                  )}
                </div>
                <div className="upcoming-details">
                  <div className="upcoming-site">{service.job_site_name}</div>
                  <div className="upcoming-type">{service.service_type}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/schedule" className="action-btn primary">
            Open Service Manager
          </Link>
          <Link to="/services" className="action-btn">
            Add New Service
          </Link>
          <Link to="/job-sites" className="action-btn">
            Add Job Site
          </Link>
          <Link to="/calendar" className="action-btn">
            View Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
