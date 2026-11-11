CREATE TABLE IF NOT EXISTS players (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, player_id uuid NOT NULL REFERENCES players(id), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS player_profiles (player_id uuid PRIMARY KEY REFERENCES players(id), nickname text NOT NULL, association_id text NOT NULL CHECK (association_id IN ('lebarc','bakaclub','arise')), presentation text NOT NULL, revision integer NOT NULL CHECK (revision > 0));
CREATE TABLE IF NOT EXISTS profile_submissions (submission_id uuid PRIMARY KEY, player_id uuid NOT NULL REFERENCES players(id), nickname text NOT NULL, association_id text NOT NULL, presentation text NOT NULL, revision integer NOT NULL, created_at timestamptz NOT NULL, UNIQUE(player_id, revision));
CREATE TABLE IF NOT EXISTS outbox_events (submission_id uuid PRIMARY KEY REFERENCES profile_submissions(submission_id), payload jsonb NOT NULL, delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox_events(submission_id) WHERE delivered_at IS NULL;
CREATE TABLE IF NOT EXISTS game_states (player_id uuid PRIMARY KEY REFERENCES players(id), state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS processed_actions (player_id uuid NOT NULL REFERENCES players(id), request_id uuid NOT NULL, fingerprint text NOT NULL, response jsonb NOT NULL, PRIMARY KEY(player_id, request_id));
