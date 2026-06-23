-- Development DB initialization script
-- This will run automatically when the Postgres container initializes (only on empty DB)

-- Create a simple users table for development and a seed admin user
CREATE TABLE IF NOT EXISTS "users" (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT now()
);

-- Insert a development admin user. Password is plain-text here for convenience in dev only.
-- Replace with hashed passwords or remove before using in any shared environment.
INSERT INTO "users" (username, password, display_name)
VALUES ('admin', 'password', 'Development Admin')
ON CONFLICT (username) DO NOTHING;

-- Example table for domain data (adjust to your schema needs)
CREATE TABLE IF NOT EXISTS "items" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO "items" (name, description)
VALUES ('Example item', 'Seeded example item for development')
ON CONFLICT DO NOTHING;

-- End of init.sql

