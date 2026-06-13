-- Add office shift arrival times and departure buffer to app_settings defaults
INSERT INTO app_settings (key, value) VALUES
  ('office_arrival_morning',   '09:00'),
  ('office_arrival_afternoon', '14:00'),
  ('office_arrival_night',     '21:00'),
  ('route_departure_buffer',   '30')
ON CONFLICT (key) DO NOTHING;
