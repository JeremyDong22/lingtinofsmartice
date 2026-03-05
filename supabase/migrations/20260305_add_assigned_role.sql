-- Add assigned_role column for role-based action item distribution
-- Values: manager | head_chef | front_of_house | all
ALTER TABLE lingtin_action_items
  ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(30);
