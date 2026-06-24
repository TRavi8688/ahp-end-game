-- Add source column to support_tickets table
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web';
