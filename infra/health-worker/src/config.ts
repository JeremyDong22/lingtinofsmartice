import type { EndpointDef } from './types';

/** Timeout threshold for patrol checks (ms) */
export const PATROL_TIMEOUT_MS = 10_000;

/** Timeout for heartbeat checks (ms) */
export const HEARTBEAT_TIMEOUT_MS = 15_000;

/** Heartbeat endpoints — checked every 5 minutes */
export const HEARTBEAT_ENDPOINTS: EndpointDef[] = [
  {
    path: '/',
    description: '前端首页',
    role_code: 'system',
  },
  {
    path: '/api/audio/stt-health',
    description: 'STT 健康检测',
    role_code: 'system',
  },
  {
    path: '/api/auth/login',
    description: '登录认证+数据库',
    role_code: 'system',
    method: 'POST',
  },
];

/** Test restaurant ID used by health check accounts */
const TEST_RESTAURANT_ID = '96592966-31b7-4ca5-b6bd-109318b57cf5';

/** Patrol endpoints — checked at 09:00 and 15:00 CST */
export const PATROL_ENDPOINTS: EndpointDef[] = [
  // Public
  {
    path: '/api/audio/stt-health',
    description: 'STT 健康检测',
    role_code: 'system',
  },

  // Administrator
  {
    path: '/api/dashboard/briefing',
    description: '管理端简报',
    role_code: 'administrator',
  },
  {
    path: '/api/dashboard/restaurants-overview',
    description: '门店概览',
    role_code: 'administrator',
  },
  {
    path: '/api/dashboard/execution-overview',
    description: '执行概览',
    role_code: 'administrator',
  },
  {
    path: '/api/dashboard/brand-kpi?brand_id=1',
    description: '品牌KPI',
    role_code: 'administrator',
  },
  {
    path: '/api/staff/insights?days=7',
    description: '员工洞察',
    role_code: 'administrator',
  },
  {
    path: '/api/meeting/admin-overview',
    description: '会议管理概览',
    role_code: 'administrator',
  },
  {
    path: '/api/feedback/all?page=1&pageSize=1',
    description: '用户反馈列表',
    role_code: 'administrator',
  },

  // Manager
  {
    path: `/api/dashboard/sentiment-summary?restaurant_id=${TEST_RESTAURANT_ID}`,
    description: '情感摘要',
    role_code: 'manager',
  },
  {
    path: `/api/dashboard/suggestions?restaurant_id=${TEST_RESTAURANT_ID}`,
    description: '改善建议',
    role_code: 'manager',
  },
  {
    path: `/api/dashboard/execution-summary?restaurant_id=${TEST_RESTAURANT_ID}`,
    description: '执行摘要',
    role_code: 'manager',
  },
  {
    path: '/api/action-items/pending',
    description: '待办事项(店长)',
    role_code: 'manager',
  },
  {
    path: `/api/question-templates/active?restaurant_id=${TEST_RESTAURANT_ID}`,
    description: '问题模板',
    role_code: 'manager',
  },
  {
    path: '/api/daily-summary?date=today',
    description: '每日总结',
    role_code: 'manager',
  },

  // Chef
  {
    path: '/api/action-items/pending',
    description: '待办事项(厨师长)',
    role_code: 'chef',
  },
  {
    path: `/api/dashboard/dish-ranking?restaurant_id=${TEST_RESTAURANT_ID}`,
    description: '菜品排行',
    role_code: 'chef',
  },
  {
    path: '/api/meeting/today',
    description: '今日会议',
    role_code: 'chef',
  },
];
