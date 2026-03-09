-- Health monitor test accounts (3 roles)
-- Password: health_monitor_2026 (bcrypt hashed)
INSERT INTO master_employee (id, username, password_hash, employee_name, restaurant_id, role_code, is_active, is_super_admin)
VALUES
  (gen_random_uuid(), 'health_admin', crypt('health_monitor_2026', gen_salt('bf')), '巡检账号-管理员', '684f98e6-293a-4362-a0e1-e388483bf89c', 'administrator', true, false),
  (gen_random_uuid(), 'health_manager', crypt('health_monitor_2026', gen_salt('bf')), '巡检账号-店长', '684f98e6-293a-4362-a0e1-e388483bf89c', 'manager', true, false),
  (gen_random_uuid(), 'health_chef', crypt('health_monitor_2026', gen_salt('bf')), '巡检账号-厨师长', '684f98e6-293a-4362-a0e1-e388483bf89c', 'chef', true, false);
