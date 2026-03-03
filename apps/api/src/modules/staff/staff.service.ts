// Staff Service - Business logic for employee data queries
// v1.1 - Added getInsights() for cross-store product insights

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

// Topic classification rules
const TOPIC_RULES: { code: string; label: string; icon: string; keywords: string[] }[] = [
  { code: 'dish_quality', label: '菜品口味与质量', icon: '🍳', keywords: ['菜', '味', '咸', '淡', '辣', '酸', '甜', '苦', '鲜', '油', '腥', '糊', '焦', '硬', '软', '烂', '生', '熟', '口味', '口感', '食材', '配料', '调味', '好吃', '难吃', '退菜'] },
  { code: 'service_skill', label: '服务话术与技巧', icon: '💬', keywords: ['话术', '沟通', '回复', '回答', '追问', '怎么说', '怎么问', '顾客说', '还行', '一般', '挽回', '推荐'] },
  { code: 'complaint', label: '投诉处理与应对', icon: '🔥', keywords: ['投诉', '差评', '不满', '生气', '赔偿', '退款', '道歉', '处理', '应对', '危机'] },
  { code: 'data_usage', label: '数据查询与使用', icon: '📊', keywords: ['数据', '报表', '统计', '排名', '对比', '趋势', '分析', '覆盖率', '情绪', '评分'] },
  { code: 'speed', label: '出菜速度与效率', icon: '⏱️', keywords: ['速度', '等', '慢', '快', '上菜', '出菜', '催', '效率', '超时'] },
  { code: 'menu', label: '菜单与排菜', icon: '📋', keywords: ['菜单', '排菜', '新菜', '下架', '推荐菜', '特价', '套餐', '搭配'] },
  { code: 'team', label: '团队管理与培训', icon: '👥', keywords: ['员工', '培训', '排班', '绩效', '考核', '激励', '新人', '带教'] },
];

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // Get chat history for all employees in a restaurant
  async getChatHistory(restaurantId: string) {
    this.logger.log(`Getting chat history for restaurant: ${restaurantId}`);

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('chat_history')
      .select('id, employee_name, content, role, created_at, session_id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error(`Error fetching chat history: ${error.message}`);
      return { items: [] };
    }

    this.logger.log(`Found ${data?.length || 0} chat history items`);
    return { items: data || [] };
  }

  // Get visit records with manager questions and customer answers
  async getVisitRecords(restaurantId: string) {
    this.logger.log(`Getting visit records for restaurant: ${restaurantId}`);

    const client = this.supabase.getClient();

    // Join with master_employee to get employee name
    const { data, error } = await client
      .from('lingtin_visit_records')
      .select(`
        id,
        table_id,
        manager_questions,
        customer_answers,
        ai_summary,
        sentiment_score,
        created_at,
        employee_id
      `)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error(`Error fetching visit records: ${error.message}`);
      return { items: [] };
    }

    // Get employee names for the records
    const employeeIds = [...new Set((data || []).map(r => r.employee_id).filter(Boolean))];

    let employeeMap: Record<string, string> = {};
    if (employeeIds.length > 0) {
      const { data: employees } = await client
        .from('master_employee')
        .select('id, employee_name')
        .in('id', employeeIds);

      if (employees) {
        employeeMap = employees.reduce((acc, emp) => {
          acc[emp.id] = emp.employee_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Map employee names to records
    const items = (data || []).map(record => ({
      ...record,
      employee_name: record.employee_id ? employeeMap[record.employee_id] || '店长' : '店长',
    }));

    this.logger.log(`Found ${items.length} visit records`);
    return { items };
  }

  // Get cross-store product insights — aggregates chat questions + visit records
  async getInsights(days: number = 7) {
    this.logger.log(`Getting product insights for last ${days} days`);
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    // 1+2. Fetch chat_history and visit_records in parallel
    const [chatRes, visitRes] = await Promise.all([
      client
        .from('chat_history')
        .select('id, content, employee_name, restaurant_id, created_at')
        .eq('role', 'user')
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: false })
        .limit(500),
      client
        .from('lingtin_visit_records')
        .select('id, manager_questions, employee_id, restaurant_id, created_at')
        .eq('status', 'completed')
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    const chatRows = chatRes.data;
    const visitRows = visitRes.data;

    // 3. Collect all restaurant IDs and employee IDs for name lookup
    const restaurantIds = new Set<string>();
    const employeeIds = new Set<string>();
    (chatRows || []).forEach(r => r.restaurant_id && restaurantIds.add(r.restaurant_id));
    (visitRows || []).forEach(r => {
      r.restaurant_id && restaurantIds.add(r.restaurant_id);
      r.employee_id && employeeIds.add(r.employee_id);
    });

    // Fetch restaurant names + employee info in parallel
    const [restaurantMap, employeeMap] = await Promise.all([
      (async () => {
        if (restaurantIds.size === 0) return {} as Record<string, string>;
        const { data: rests } = await client
          .from('master_restaurant')
          .select('id, restaurant_name')
          .in('id', [...restaurantIds]);
        return (rests || []).reduce((acc, r) => {
          acc[r.id] = r.restaurant_name;
          return acc;
        }, {} as Record<string, string>);
      })(),
      (async () => {
        if (employeeIds.size === 0) return {} as Record<string, { name: string; role: string }>;
        const { data: emps } = await client
          .from('master_employee')
          .select('id, employee_name, role_code')
          .in('id', [...employeeIds]);
        return (emps || []).reduce((acc, e) => {
          acc[e.id] = { name: e.employee_name, role: e.role_code || 'manager' };
          return acc;
        }, {} as Record<string, { name: string; role: string }>);
      })(),
    ]);

    // 4. Build question items from both sources
    interface QuestionItem {
      text: string;
      source: 'chat' | 'visit';
      employeeName: string;
      role: string;
      restaurantId: string;
      restaurantName: string;
      createdAt: string;
    }

    const questions: QuestionItem[] = [];

    // From chat history
    for (const row of chatRows || []) {
      if (!row.content || row.content.length < 4) continue;
      questions.push({
        text: row.content,
        source: 'chat',
        employeeName: row.employee_name || '员工',
        role: '店长', // chat users are typically managers
        restaurantId: row.restaurant_id,
        restaurantName: restaurantMap[row.restaurant_id] || '门店',
        createdAt: row.created_at,
      });
    }

    // From visit record manager_questions
    for (const row of visitRows || []) {
      const mqArr = Array.isArray(row.manager_questions) ? row.manager_questions : [];
      const emp = row.employee_id ? employeeMap[row.employee_id] : null;
      const roleName = emp?.role === 'head_chef' ? '厨师长' : '店长';
      for (const q of mqArr) {
        if (typeof q !== 'string' || q.length < 4) continue;
        questions.push({
          text: q,
          source: 'visit',
          employeeName: emp?.name || '店长',
          role: roleName,
          restaurantId: row.restaurant_id,
          restaurantName: restaurantMap[row.restaurant_id] || '门店',
          createdAt: row.created_at,
        });
      }
    }

    // 5. Classify each question into a topic
    function classifyTopic(text: string): string {
      for (const rule of TOPIC_RULES) {
        if (rule.keywords.some(kw => text.includes(kw))) {
          return rule.code;
        }
      }
      return 'other';
    }

    // 6. Aggregate by topic
    interface TopicAgg {
      code: string;
      label: string;
      icon: string;
      restaurants: Set<string>;
      roles: Set<string>;
      people: Set<string>;
      items: { text: string; employeeName: string; role: string; restaurantName: string; count: number }[];
    }

    const topicMap: Record<string, TopicAgg> = {};

    for (const q of questions) {
      const topicCode = classifyTopic(q.text);
      const rule = TOPIC_RULES.find(r => r.code === topicCode);
      const label = rule?.label || '其他';
      const icon = rule?.icon || '💡';

      if (!topicMap[topicCode]) {
        topicMap[topicCode] = {
          code: topicCode,
          label,
          icon,
          restaurants: new Set(),
          roles: new Set(),
          people: new Set(),
          items: [],
        };
      }

      const topic = topicMap[topicCode];
      topic.restaurants.add(q.restaurantName);
      topic.roles.add(q.role);
      topic.people.add(`${q.employeeName}@${q.restaurantId}`);

      // Dedup similar questions (simple: exact match on first 20 chars)
      const shortText = q.text.slice(0, 30);
      const existing = topic.items.find(i => i.text.slice(0, 30) === shortText);
      if (existing) {
        existing.count += 1;
      } else {
        topic.items.push({
          text: q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text,
          employeeName: q.employeeName,
          role: q.role,
          restaurantName: q.restaurantName,
          count: 1,
        });
      }
    }

    // 7. Convert to sorted array
    const topics = Object.values(topicMap)
      .map(t => ({
        code: t.code,
        label: t.label,
        icon: t.icon,
        peopleCount: t.people.size,
        restaurants: [...t.restaurants],
        roles: [...t.roles],
        items: t.items.sort((a, b) => b.count - a.count).slice(0, 5),
      }))
      .sort((a, b) => b.peopleCount - a.peopleCount);

    // 8. Cross-store highlights (3+ stores)
    const crossStore = topics
      .filter(t => t.restaurants.length >= 3)
      .map(t => ({ label: t.label, icon: t.icon, storeCount: t.restaurants.length }));

    const totalPeople = new Set(questions.map(q => `${q.employeeName}@${q.restaurantId}`)).size;

    this.logger.log(`Insights: ${topics.length} topics, ${questions.length} questions, ${totalPeople} people`);

    return {
      days,
      totalPeople,
      totalQuestions: questions.length,
      crossStore,
      topics,
    };
  }
}
