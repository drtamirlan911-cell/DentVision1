-- EventBus delivery is at-least-once. Prevent duplicate AI Employee work items
-- when the same CRM event is replayed or delivered twice.
CREATE UNIQUE INDEX IF NOT EXISTS ai_employee_tasks_event_action_role_uidx
  ON ai_employee_tasks (source_event_id, action, role)
  WHERE source_event_id IS NOT NULL AND action IS NOT NULL;
