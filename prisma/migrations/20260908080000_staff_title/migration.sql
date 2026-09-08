-- Barber title shown on cards (defaults to house title).
ALTER TABLE staff ADD COLUMN title VARCHAR(100) DEFAULT 'Hairstylist & Barber';
