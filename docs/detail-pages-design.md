# Detail Pages Design

## Overview

Add drill-down detail pages for recurring services and job sites, accessible from their respective list pages.

---

## Recurring Service Detail Page

### Route
```
/services/:serviceId
```

### Navigation
- Click on service row in ServicesPage table → navigates to detail page
- Breadcrumb: Services > [Job Site Name] - [Service Type]

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Services                                              │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SERVICE DETAILS                                             │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Job Site:        ABC Company                    [View Site] │ │
│ │ Service Type:    Cleaning                                   │ │
│ │ Frequency:       Monthly (2nd Tuesday)                      │ │
│ │ Day Constraint:  Tuesday                                    │ │
│ │ Last Service:    January 14, 2025                           │ │
│ │ Next Service:    February 11, 2025                          │ │
│ │ Status:          Active                                     │ │
│ │ Priority:        Normal                                     │ │
│ │ Notes:           Contact John at front desk                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ACTIONS                                                     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ [Edit Service]  [Pause Service]  [Cancel Service]           │ │
│ │                                                             │ │
│ │ Pause: Temporarily stop scheduling. Service can be resumed. │ │
│ │ Cancel: Permanently deactivate. Keeps history.              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SERVICE HISTORY                                             │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Date         Event        Details              Performed By │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ Jan 14, 2025 Completed    -                    John Smith   │ │
│ │ Dec 10, 2024 Completed    -                    Jane Doe     │ │
│ │ Nov 12, 2024 Rescheduled  → Nov 15, 2024       System       │ │
│ │ Nov 15, 2024 Completed    -                    John Smith   │ │
│ │ Oct 8, 2024  Cancelled    Customer request     Jane Doe     │ │
│ │ Sep 10, 2024 Completed    -                    John Smith   │ │
│ │                                                             │ │
│ │ Showing 6 of 24 events              [Load More]             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Requirements

**Service Details** (existing endpoint: `GET /api/services/:id`)
- All fields from `recurring_services` table
- Joined `job_site` data

**Service History** (new endpoint needed: `GET /api/services/:id/history`)
- Filter `service_events` by `recurring_service_id`
- Order by `event_date` DESC
- Pagination support

### Actions

| Action | Behavior | API |
|--------|----------|-----|
| Edit Service | Open edit modal/form | `PUT /api/services/:id` |
| Pause Service | Set status to paused, stop scheduling | `PUT /api/services/:id` with `status: 'paused'` |
| Resume Service | Set status back to active | `PUT /api/services/:id` with `status: 'active'` |
| Cancel Service | Soft delete, keeps history | `DELETE /api/services/:id` (sets `is_active: false`) |

**Note**: May need to add a `status` field to distinguish between:
- `active` - normal scheduling
- `paused` - temporarily stopped, can resume
- `cancelled` - permanently stopped

Currently only have `is_active` boolean.

---

## Job Site Detail Page

### Route
```
/job-sites/:siteId
```

### Navigation
- Click on job site row in JobSitesPage table → navigates to detail page
- Also accessible via "View Site" link from Service Detail page
- Breadcrumb: Job Sites > [Site Name]

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Job Sites                                             │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SITE DETAILS                                                │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Name:     ABC Company                                       │ │
│ │ Address:  123 Main Street                                   │ │
│ │ City:     Springfield                                       │ │
│ │ County:   Greene                                            │ │
│ │ Zip:      12345                                             │ │
│ │                                                             │ │
│ │ [Edit Site]                                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SERVICES AT THIS SITE                                       │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Service Type   Frequency           Next Service   Status    │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ Cleaning       Monthly (2nd Tue)   Feb 11, 2025   Active  → │ │
│ │ Inspection     Quarterly           Apr 1, 2025    Active  → │ │
│ │ Maintenance    Monthly (Last Fri)  -              Paused  → │ │
│ │                                                             │ │
│ │ [Add Service to This Site]                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SITE HISTORY                                                │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Date         Service      Event        Performed By         │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ Jan 14, 2025 Cleaning     Completed    John Smith           │ │
│ │ Jan 10, 2025 Inspection   Completed    Jane Doe             │ │
│ │ Dec 10, 2024 Cleaning     Completed    John Smith           │ │
│ │ Dec 5, 2024  Maintenance  Paused       Admin                │ │
│ │ Nov 15, 2024 Cleaning     Completed    John Smith           │ │
│ │                                                             │ │
│ │ Showing 5 of 48 events              [Load More]             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Requirements

**Site Details** (existing endpoint: `GET /api/job-sites/:id`)
- All fields from `job_sites` table

**Services at Site** (new endpoint needed: `GET /api/job-sites/:id/services`)
- Filter `recurring_services` by `job_site_id`
- Include both active and inactive (with status indicator)

**Site History** (new endpoint needed: `GET /api/job-sites/:id/history`)
- Join `service_events` → `recurring_services` → filter by `job_site_id`
- Include service type in each event row
- Order by `event_date` DESC
- Pagination support

---

## New API Endpoints

### GET /api/services/:id/history

```javascript
// Request
GET /api/services/123/history?limit=10&offset=0

// Response
{
  "events": [
    {
      "id": "evt-1",
      "event_type": "completed",
      "event_date": "2025-01-14",
      "scheduled_date": "2025-01-14",
      "rescheduled_to": null,
      "completed_date": "2025-01-14",
      "performed_by": "John Smith",
      "notes": null
    },
    {
      "id": "evt-2",
      "event_type": "rescheduled",
      "event_date": "2024-11-12",
      "scheduled_date": "2024-11-12",
      "rescheduled_to": "2024-11-15",
      "completed_date": null,
      "performed_by": "System",
      "notes": "Holiday conflict"
    }
  ],
  "total": 24,
  "limit": 10,
  "offset": 0
}
```

### GET /api/job-sites/:id/services

```javascript
// Request
GET /api/job-sites/456/services

// Response
{
  "services": [
    {
      "id": "svc-1",
      "service_type": "Cleaning",
      "frequency": "Monthly",
      "week_pattern": 2,
      "day_of_week": "Tuesday",
      "last_service_date": "2025-01-14",
      "next_service_date": "2025-02-11",  // calculated
      "status": "active"
    },
    {
      "id": "svc-2",
      "service_type": "Maintenance",
      "frequency": "Monthly",
      "week_pattern": "Last",
      "day_of_week": "Friday",
      "last_service_date": "2024-11-29",
      "next_service_date": null,
      "status": "paused"
    }
  ]
}
```

### GET /api/job-sites/:id/history

```javascript
// Request
GET /api/job-sites/456/history?limit=10&offset=0

// Response
{
  "events": [
    {
      "id": "evt-1",
      "service_id": "svc-1",
      "service_type": "Cleaning",
      "event_type": "completed",
      "event_date": "2025-01-14",
      "performed_by": "John Smith",
      "notes": null
    }
  ],
  "total": 48,
  "limit": 10,
  "offset": 0
}
```

---

## React Components

### New Pages

```
web/src/pages/
├── ServiceDetailPage.jsx    # /services/:serviceId
└── JobSiteDetailPage.jsx    # /job-sites/:siteId
```

### Shared Components

```
web/src/components/
├── common/
│   ├── BackLink.jsx         # "← Back to X" navigation
│   ├── DetailCard.jsx       # Reusable card with title + content
│   ├── StatusBadge.jsx      # Active/Paused/Cancelled indicator
│   └── Pagination.jsx       # Load more / page controls
├── services/
│   ├── ServiceInfo.jsx      # Service details display
│   ├── ServiceActions.jsx   # Edit/Pause/Cancel buttons
│   └── ServiceHistory.jsx   # History table for a service
└── job-sites/
    ├── SiteInfo.jsx         # Site details display
    ├── SiteServices.jsx     # List of services at site
    └── SiteHistory.jsx      # History table for a site
```

---

## Route Updates

```jsx
// App.jsx additions
<Route path="services/:serviceId" element={<ServiceDetailPage />} />
<Route path="job-sites/:siteId" element={<JobSiteDetailPage />} />
```

---

## Database Changes

### Add status field to recurring_services

Currently only `is_active` boolean. Need more granular status:

```sql
-- Add status column
ALTER TABLE recurring_services
ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Migrate existing data
UPDATE recurring_services
SET status = CASE WHEN is_active THEN 'active' ELSE 'cancelled' END;

-- status values: 'active', 'paused', 'cancelled'
```

### Add index for job site history queries

```sql
CREATE INDEX idx_service_events_job_site
ON service_events(recurring_service_id);

-- The join to get job_site_id will use the existing
-- recurring_services.job_site_id index
```

---

## Implementation Order

1. **API endpoints** - Add the three new endpoints
2. **Database** - Add status field migration
3. **ServiceDetailPage** - Core detail page with history
4. **JobSiteDetailPage** - Site detail with services list and history
5. **List page updates** - Make rows clickable, link to detail pages
6. **Shared components** - Extract reusable pieces

---

## Navigation Flow

```
ServicesPage
    │
    ├── Click service row → ServiceDetailPage
    │                           │
    │                           └── "View Site" → JobSiteDetailPage
    │
JobSitesPage
    │
    ├── Click site row → JobSiteDetailPage
    │                        │
    │                        └── Click service → ServiceDetailPage
```

Both detail pages cross-link to each other for easy navigation.
