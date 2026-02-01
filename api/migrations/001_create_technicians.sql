-- Create technicians table
CREATE TABLE IF NOT EXISTS technicians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on name for sorting
CREATE INDEX IF NOT EXISTS idx_technicians_name ON technicians(name);

-- Insert initial technicians
INSERT INTO technicians (name, is_active) VALUES
  ('Alex', true),
  ('Dennis', true),
  ('Jerry', true),
  ('John', true),
  ('Johnathan', true),
  ('Josh', true),
  ('Justin', true),
  ('Layton', true),
  ('Mark', true),
  ('Michael', true),
  ('Nick', true)
ON CONFLICT DO NOTHING;
