# EPADLS Web Application - Implementation Plan (Revised)

## Overview

Migrating the EPADLS Scheduler from a Google Apps Script + Google Sheets system to a standalone web application with a simplified, database-native architecture.

## Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | React | Vercel |
| Backend | Node.js (Express) REST API | Render |
| Database | PostgreSQL | Supabase |
| Authentication | Supabase Auth | Supabase |
| PDF Generation | PDFKit | - |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React App     │────▶│  Node.js API    │────▶│    Supabase     │
│   (Vercel)      │     │  (Render)       │     │  (PostgreSQL)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    PDFKit       │
                        │ (Ticket Gen)    │
                        └─────────────────┘
```

**Design Principle:** Full backend approach - all data access goes through the Node.js API. React never talks to Supabase directly.

---

## Simplified Architecture (vs Google Sheets Version)

### What We're Removing

| Old Pattern | Why It Existed | New Approach |
|-------------|----------------|--------------|
| **Future Schedule sheet** | Sheets can't do dynamic queries, so we pre-generated 45 days of services | Calculate on-the-fly with SQL. Only store records when something actually happens. |
| **TransactionalProcessor snapshots** | Sheets has no transactions | Use PostgreSQL transactions (`BEGIN/COMMIT/ROLLBACK`) |
| **Sheet regeneration** | UI was the sheet itself | React renders from API queries |
| **JobSiteManager cache** | Sheets API was slow | Database is fast; use simple queries (can add Redis later if needed) |
| **Service Management sheet** | Temporary working view | Just a React component with state |

### Key Simplification: No Pre-Generated Schedule

**Old model:**
```
recurring_services → [generate 45 days] → future_schedule → [user sees list]
```

**New model:**
```
recurring_services → [query calculates upcoming] → [user sees list]
```

The query/function calculates: "Given `last_service_date` and `frequency`, what are the next N occurrences?" This is computed at query time, not stored.

We only create `service_events` records when something happens:
- User completes a service → create event with status `completed`
- User cancels a service → create event with status `cancelled`
- User reschedules → create event with status `rescheduled` + new date

---

## Database Schema

### Tables

#### `job_sites`
```sql
CREATE TABLE job_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  street_number VARCHAR(50),
  street_address VARCHAR(255),
  city VARCHAR(100),
  zip_code VARCHAR(20),
  county VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `recurring_services`
The "template" defining each recurring service.

```sql
CREATE TABLE recurring_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  last_service_date DATE,
  day_constraint VARCHAR(20),       -- e.g., "Monday", "Friday"
  time_constraint VARCHAR(50),      -- e.g., "Morning", "9am-12pm"
  priority INTEGER DEFAULT 0,
  notes TEXT,
  manifest_county VARCHAR(100),     -- County for compliance reporting
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_recurring_services_job_site ON recurring_services(job_site_id);
CREATE INDEX idx_recurring_services_active ON recurring_services(is_active) WHERE is_active = TRUE;
```

**Frequency values:** `weekly`, `Every 2 weeks`, `Every 4 weeks`, `Every 8 weeks`, `Every 3 months`, `Every 4 months`, `Every 6 months`, `Annually`

#### `service_events`
Records actual events (completions, cancellations, reschedules). This replaces both `Future Schedule` and `Action History`.

```sql
CREATE TABLE service_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_service_id UUID NOT NULL REFERENCES recurring_services(id) ON DELETE CASCADE,

  -- The date this service instance was originally scheduled for
  scheduled_date DATE NOT NULL,

  -- What happened
  event_type VARCHAR(20) NOT NULL,  -- 'completed', 'cancelled', 'rescheduled'
  event_date DATE NOT NULL,         -- When the action was taken

  -- For reschedules: the new date it was moved to
  rescheduled_to DATE,

  -- For completions: actual completion date (might differ from scheduled)
  completed_date DATE,

  performed_by VARCHAR(100),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_service_events_recurring ON service_events(recurring_service_id);
CREATE INDEX idx_service_events_scheduled ON service_events(scheduled_date);
CREATE INDEX idx_service_events_type ON service_events(event_type);
```

#### `manifest_entries`
Compliance records (separate from events for cleaner reporting).

```sql
CREATE TABLE manifest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_service_id UUID NOT NULL REFERENCES recurring_services(id),
  job_site_id UUID NOT NULL REFERENCES job_sites(id),
  date_completed DATE NOT NULL,
  quarter VARCHAR(10) NOT NULL,     -- e.g., "Q1 2025"
  county VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manifest_quarter_county ON manifest_entries(quarter, county);
```

#### `users`
Extended from Supabase Auth.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',  -- 'admin', 'user'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Core Logic: Calculating Upcoming Services

Instead of pre-generating, we calculate upcoming services on demand.

### PostgreSQL Function

```sql
CREATE OR REPLACE FUNCTION get_upcoming_services(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '45 days'
)
RETURNS TABLE (
  recurring_service_id UUID,
  job_site_id UUID,
  job_site_name VARCHAR,
  address TEXT,
  service_type VARCHAR,
  frequency VARCHAR,
  scheduled_date DATE,
  days_overdue INTEGER,
  is_rescheduled BOOLEAN,
  notes TEXT
) AS $$
-- Implementation calculates next dates from last_service_date + frequency
-- Handles day constraints and weekend avoidance
-- Joins with service_events to check for reschedules
$$ LANGUAGE plpgsql;
```

Alternatively, this logic can live entirely in Node.js (might be easier to maintain and test).

### Node.js Service: ScheduleCalculator

```javascript
// Calculate upcoming service dates for a recurring service
function calculateUpcomingDates(recurringService, startDate, endDate) {
  const dates = [];
  let currentDate = new Date(recurringService.last_service_date);

  while (currentDate <= endDate) {
    const nextDate = calculateNextServiceDate(
      currentDate,
      recurringService.frequency,
      recurringService.day_constraint
    );

    if (nextDate > endDate) break;
    if (nextDate >= startDate) {
      dates.push(nextDate);
    }
    currentDate = nextDate;
  }

  return dates;
}
```

---

## Data Import Strategy

### Source Sheets → Target Tables

| Google Sheet | PostgreSQL Table | Notes |
|--------------|------------------|-------|
| Job Sites | `job_sites` | Direct mapping |
| Recurring Services | `recurring_services` | Direct mapping, drop `Next Service Date` (calculated) |
| Action History | `service_events` | Map action types to event_type |
| Manifest Log | `manifest_entries` | Direct mapping |
| Future Schedule | *(not imported)* | Will be calculated dynamically |
| Service Management | *(not imported)* | Temporary UI state |
| Calendar View | *(not imported)* | Generated view |

### Import Process

1. **Export from Google Sheets**
   - Download each sheet as CSV
   - Or use Google Sheets API to export JSON

2. **Import Order** (respects foreign keys)
   ```
   1. job_sites
   2. recurring_services (references job_sites)
   3. service_events (references recurring_services)
   4. manifest_entries (references both)
   ```

3. **Column Mappings**

**Job Sites:**
| Sheet Column | DB Column |
|--------------|-----------|
| Job Site ID | id (or generate new UUID) |
| Job Site Name | name |
| Address | address |
| Street Number | street_number |
| Street Address | street_address |
| City | city |
| Zip Code | zip_code |
| County | county |
| Latitude | latitude |
| Longitude | longitude |

**Recurring Services:**
| Sheet Column | DB Column |
|--------------|-----------|
| Service ID | id (or generate new UUID) |
| Job Site ID | job_site_id |
| Job Site Name | *(dropped - join from job_sites)* |
| Service Type | service_type |
| Frequency | frequency |
| Last Service Date | last_service_date |
| Day Constraint | day_constraint |
| Time Constraint | time_constraint |
| Priority | priority |
| Notes | notes |
| Next Service Date | *(dropped - calculated)* |
| Manifest County | manifest_county |

**Action History → service_events:**
| Sheet Column | DB Column |
|--------------|-----------|
| Date Recorded | created_at |
| Service ID | recurring_service_id |
| Scheduled Date | scheduled_date |
| Action Type | event_type (mapped) |
| Action Date | event_date |
| Performed By | performed_by |
| Notes | notes |

Action Type mapping:
- `COMPLETED ON:` → `completed`
- `CANCELLED` → `cancelled`
- `RESCHEDULED TO:` → `rescheduled`

4. **Import Script Location**
   - `api/scripts/import-from-sheets.js`
   - Reads CSV files from `data/import/` directory
   - Validates data before insert
   - Handles ID mapping (old IDs → new UUIDs)

---

## Easy Service Addition

### Requirements
- Quick form to add new recurring services
- Job site autocomplete/search
- Sensible defaults
- Bulk import option

### UI Design

**Quick Add Form (Modal or Sidebar):**
```
┌─────────────────────────────────────────────┐
│ Add New Recurring Service                   │
├─────────────────────────────────────────────┤
│                                             │
│ Job Site *        [Autocomplete search   ]  │
│                   ↳ Shows matching sites    │
│                                             │
│ Service Type *    [Dropdown or text      ]  │
│                   Common: Grease Trap,      │
│                   Septic, etc.              │
│                                             │
│ Frequency *       [Every 4 weeks      ▼  ]  │
│                                             │
│ Starting From *   [Date picker         📅]  │
│                   (First service date)      │
│                                             │
│ ─ ─ ─ ─ ─ Optional ─ ─ ─ ─ ─                │
│                                             │
│ Day Preference    [Any day            ▼  ]  │
│                   Monday, Tuesday, etc.     │
│                                             │
│ Time Preference   [                      ]  │
│                                             │
│ Priority          [Normal             ▼  ]  │
│                                             │
│ Manifest County   [                      ]  │
│                   (For compliance)          │
│                                             │
│ Notes             [                      ]  │
│                   [                      ]  │
│                                             │
│         [Cancel]            [Add Service]   │
└─────────────────────────────────────────────┘
```

### Features

1. **Job Site Autocomplete**
   - Search by name, address, or city
   - Shows full address in dropdown
   - Option to "Add new job site" inline

2. **Smart Defaults**
   - Frequency defaults to most common (e.g., "Every 4 weeks")
   - Starting date defaults to today
   - Day preference defaults to "Any"

3. **Quick Duplicate**
   - From existing service list, "Duplicate" button
   - Pre-fills form with same job site, allows changing service type/frequency

4. **Bulk Import**
   - CSV upload for adding multiple services
   - Template download with expected columns
   - Preview before import with validation

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login via Supabase |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Job Sites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/job-sites` | List all (with search: `?q=term`) |
| GET | `/api/job-sites/:id` | Get single |
| POST | `/api/job-sites` | Create |
| PUT | `/api/job-sites/:id` | Update |
| DELETE | `/api/job-sites/:id` | Delete |

### Recurring Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | List all (filterable) |
| GET | `/api/services/:id` | Get single with job site details |
| POST | `/api/services` | Create new recurring service |
| PUT | `/api/services/:id` | Update |
| DELETE | `/api/services/:id` | Soft delete (is_active=false) |

### Schedule (Upcoming Services)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule` | Get upcoming services |
| | | Query params: `startDate`, `endDate` |
| POST | `/api/schedule/actions` | Process batch actions |
| | | Body: `{ completions: [], cancellations: [], reschedules: [] }` |

### Calendar
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar` | Get calendar data |
| | | Query params: `year`, `month` |

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | List events (filterable by date, type, service) |

### Manifests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/manifests` | Get manifest data |
| | | Query params: `quarter`, `county` |
| GET | `/api/manifests/export` | Export as CSV |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tickets` | Generate PDF for selected services |
| | | Body: `{ serviceIds: [], scheduledDates: [] }` |

### Import (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/import/job-sites` | Bulk import job sites |
| POST | `/api/admin/import/services` | Bulk import services |
| POST | `/api/admin/import/history` | Import historical data |

---

## Project Structure

### API (`/api`)
```
api/
├── src/
│   ├── config/
│   │   ├── database.js         # Supabase client
│   │   └── env.js              # Environment config
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── errorHandler.js     # Global error handling
│   │   └── validate.js         # Request validation
│   ├── routes/
│   │   ├── auth.js
│   │   ├── jobSites.js
│   │   ├── services.js
│   │   ├── schedule.js
│   │   ├── calendar.js
│   │   ├── history.js
│   │   ├── manifests.js
│   │   └── tickets.js
│   ├── services/
│   │   ├── DateService.js      # Date normalization, calculations
│   │   ├── ScheduleService.js  # Calculate upcoming services
│   │   ├── ActionService.js    # Process completions/cancellations/reschedules
│   │   ├── ValidationService.js # Business rule validation
│   │   └── TicketService.js    # PDF generation
│   ├── app.js                  # Express setup
│   └── server.js               # Entry point
├── scripts/
│   └── import-from-sheets.js   # Data migration script
├── package.json
└── .env
```

### Web (`/web`)
```
web/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── DatePicker.jsx
│   │   │   └── Autocomplete.jsx
│   │   ├── layout/
│   │   │   ├── Layout.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── job-sites/
│   │   │   ├── JobSiteList.jsx
│   │   │   └── JobSiteForm.jsx
│   │   ├── services/
│   │   │   ├── ServiceList.jsx
│   │   │   ├── ServiceForm.jsx      # The "easy add" form
│   │   │   └── ServiceManager.jsx   # Main operational view
│   │   ├── calendar/
│   │   │   └── CalendarView.jsx
│   │   ├── history/
│   │   │   └── HistoryList.jsx
│   │   └── manifests/
│   │       └── ManifestReport.jsx
│   ├── pages/
│   │   ├── DashboardPage.jsx
│   │   ├── JobSitesPage.jsx
│   │   ├── ServicesPage.jsx
│   │   ├── SchedulePage.jsx         # Service Manager
│   │   ├── CalendarPage.jsx
│   │   ├── HistoryPage.jsx
│   │   ├── ManifestsPage.jsx
│   │   └── LoginPage.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useJobSites.js
│   │   ├── useServices.js
│   │   └── useSchedule.js
│   ├── services/
│   │   └── api.js                   # API client
│   ├── utils/
│   │   ├── dates.js
│   │   └── format.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── .env
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up monorepo structure (`/api`, `/web`)
- [ ] Create Supabase project
- [ ] Set up database schema (run migrations)
- [ ] Initialize Node.js API with Express
- [ ] Initialize React app with Vite
- [ ] Set up authentication flow
- [ ] Basic API health check endpoint

### Phase 2: Core Data + Import
- [ ] Implement Job Sites CRUD (API)
- [ ] Implement Recurring Services CRUD (API)
- [ ] Build data import script
- [ ] Import existing data from Google Sheets
- [ ] Basic Job Sites UI (list, add, edit)
- [ ] Basic Services UI with **easy add form**

### Phase 3: Schedule & Actions
- [ ] Implement DateService (port date logic)
- [ ] Implement ScheduleService (calculate upcoming)
- [ ] Build Schedule/Service Manager UI
- [ ] Implement batch actions (complete, cancel, reschedule)
- [ ] Implement ValidationService (chronological order rules)
- [ ] Service events logging

### Phase 4: Views & Reporting
- [ ] Calendar View API + UI
- [ ] History View API + UI
- [ ] Manifest Report API + UI
- [ ] CSV export for manifests

### Phase 5: Tickets & Polish
- [ ] PDF ticket generation with PDFKit
- [ ] Ticket selection and download UI
- [ ] Error handling and loading states
- [ ] Form validation and UX polish
- [ ] Responsive design

### Phase 6: Deploy
- [ ] Deploy API to Render
- [ ] Deploy React app to Vercel
- [ ] Environment configuration
- [ ] Production testing
- [ ] Documentation

---

## Environment Variables

### API (`/api/.env`)
```
PORT=3001
NODE_ENV=development

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
SUPABASE_JWT_SECRET=xxx

# Optional
ALLOWED_ORIGINS=http://localhost:5173
```

### Web (`/web/.env`)
```
VITE_API_URL=http://localhost:3001
```

---

## Business Logic to Port

### DateService
From `DateManager` in Code.js:
- `normalize(date)` - Set to midnight, handle edge cases
- `calculateNextServiceDate(lastDate, frequency, dayConstraint)` - Core scheduling logic
- `avoidWeekends(date)` - Saturday→Friday, Sunday→Monday
- `getDayNumber(dayName)` - "Monday" → 1

### ScheduleService
From `generateAllFutureServicesOptimized`:
- `getUpcomingServices(startDate, endDate)` - Main query
- `calculateUpcomingDates(service, start, end)` - Per-service projection
- Merge with reschedules from `service_events`

### ValidationService
From `ServiceOrderValidator`:
- `validateActionOrder(actions)` - Ensure chronological processing
- `validateRescheduleDate(originalDate, newDate)` - Business rules

### ActionService
From `TransactionalProcessor`:
- `processActions(completions, cancellations, reschedules)` - Main handler
- Uses database transactions instead of snapshots
- Updates `last_service_date` on completion
- Creates `service_events` records
- Creates `manifest_entries` for tracked services

---

## Notes

- UI mockups in `/ui-mockups/` can guide React component design
- Single-tenant for now (one organization)
- All dates stored as UTC in database, converted for display
- Frequency values must match exactly: `weekly`, `Every 2 weeks`, etc.
