CREATE TABLE IF NOT EXISTS shared_links (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  study_uid VARCHAR(255) NOT NULL,
  patient_name VARCHAR(255),
  patient_id VARCHAR(100),
  study_date VARCHAR(20),
  modality VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NULL,
  accessed_count INT DEFAULT 0,
  last_accessed TIMESTAMP
);

ALTER TABLE shared_links
  ALTER COLUMN expires_at DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_expires ON shared_links(expires_at);
