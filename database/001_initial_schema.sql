-- EPADLS Web Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension (should already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- JOB SITES
-- ============================================
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

-- Index for search
CREATE INDEX idx_job_sites_name ON job_sites(name);
CREATE INDEX idx_job_sites_city ON job_sites(city);

-- ============================================
-- RECURRING SERVICES
-- ============================================
CREATE TABLE recurring_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  last_service_date DATE,
  day_constraint VARCHAR(20),
  time_constraint VARCHAR(50),
  priority INTEGER DEFAULT 0,
  notes TEXT,
  manifest_county VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_services_job_site ON recurring_services(job_site_id);
CREATE INDEX idx_recurring_services_active ON recurring_services(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_recurring_services_frequency ON recurring_services(frequency);

-- ============================================
-- SERVICE EVENTS
-- Records actual events: completions, cancellations, reschedules
-- ============================================
CREATE TABLE service_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_service_id UUID NOT NULL REFERENCES recurring_services(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('completed', 'cancelled', 'rescheduled')),
  event_date DATE NOT NULL,
  rescheduled_to DATE,
  completed_date DATE,
  performed_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_service_events_recurring ON service_events(recurring_service_id);
CREATE INDEX idx_service_events_scheduled ON service_events(scheduled_date);
CREATE INDEX idx_service_events_type ON service_events(event_type);
CREATE INDEX idx_service_events_date ON service_events(event_date);

-- ============================================
-- MANIFEST ENTRIES
-- Compliance records for reporting
-- ============================================
CREATE TABLE manifest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_service_id UUID NOT NULL REFERENCES recurring_services(id),
  job_site_id UUID NOT NULL REFERENCES job_sites(id),
  date_completed DATE NOT NULL,
  quarter VARCHAR(10) NOT NULL,
  county VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for reporting queries
CREATE INDEX idx_manifest_quarter_county ON manifest_entries(quarter, county);
CREATE INDEX idx_manifest_date ON manifest_entries(date_completed);

-- ============================================
-- USERS (extends Supabase Auth)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATED_AT TRIGGER
-- Automatically update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_sites_updated_at
  BEFORE UPDATE ON job_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_services_updated_at
  BEFORE UPDATE ON recurring_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (Optional - enable if needed)
-- ============================================
-- ALTER TABLE job_sites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE recurring_services ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE manifest_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to add test data:
/*
INSERT INTO job_sites (name, address, city, county) VALUES
  ('Test Restaurant A', '123 Main St', 'Springfield', 'Example County'),
  ('Test Restaurant B', '456 Oak Ave', 'Springfield', 'Example County');
*/
