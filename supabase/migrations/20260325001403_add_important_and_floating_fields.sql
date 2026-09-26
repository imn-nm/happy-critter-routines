ALTER TABLE tasks ADD COLUMN is_important boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN window_start text;
ALTER TABLE tasks ADD COLUMN window_end text;
