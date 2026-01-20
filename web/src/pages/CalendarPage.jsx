import { useState, useEffect } from 'react';
import api from '../services/api';
import './CalendarPage.css';

function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [calendarData, setCalendarData] = useState({ services: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendar();
  }, [year, month]);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const data = await api.getCalendar(year, month);
      setCalendarData(data);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m - 1, 1).getDay();

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];
    const today = new Date().toISOString().split('T')[0];

    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const services = calendarData.services[dateStr] || [];
      const isToday = dateStr === today;
      const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
        >
          <div className="day-number">{day}</div>
          <div className="day-services">
            {services.slice(0, 3).map((service, i) => (
              <div key={i} className={`service-item ${service.days_overdue > 0 ? 'overdue' : ''}`}>
                {service.job_site_name}
              </div>
            ))}
            {services.length > 3 && (
              <div className="more-services">+{services.length - 3} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Monthly view of scheduled services</p>
      </div>

      <div className="calendar-nav">
        <button onClick={prevMonth}>&lt; Prev</button>
        <h2>{monthNames[month - 1]} {year}</h2>
        <button onClick={nextMonth}>Next &gt;</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="calendar-grid">
          <div className="calendar-header">Sun</div>
          <div className="calendar-header">Mon</div>
          <div className="calendar-header">Tue</div>
          <div className="calendar-header">Wed</div>
          <div className="calendar-header">Thu</div>
          <div className="calendar-header">Fri</div>
          <div className="calendar-header">Sat</div>
          {renderCalendar()}
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
