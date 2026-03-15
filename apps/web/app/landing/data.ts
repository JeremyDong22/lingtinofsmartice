// Landing page data arrays
// Extracted from page.tsx for maintainability

// ─── Form Types ───

export interface SignupForm {
  brand: string;
  category: string;
  name: string;
  position: string;
  age: string;
  phone: string;
  store_count: string;
  annual_revenue: string;
  city: string;
  help_text: string;
}

export const INITIAL_FORM: SignupForm = {
  brand: '', category: '', name: '', position: '', age: '',
  phone: '', store_count: '', annual_revenue: '', city: '', help_text: '',
};

export const STORE_COUNT_OPTIONS = ['1-3 家', '4-10 家', '11-30 家', '31-100 家', '100 家以上'];
export const REVENUE_OPTIONS = ['500 万以下', '500 万 - 2000 万', '2000 万 - 1 亿', '1 亿 - 5 亿', '5 亿以上'];

// ─── Core Capabilities (desensitized) ───

export const CAPABILITIES = [
  {
    tag: 'Perception',
    title: '场景感知引擎',
    desc: '针对餐饮经营场景构建的专用 NLU 管线。多模态信号降噪、领域意图识别——将非结构化的现场信息转化为可计算的结构化经营信号。',
    detail: '多模态输入｜实体级别归因｜亚秒级结构化输出',
  },
  {
    tag: 'Distillation',
    title: '四层知识蒸馏架构',
    desc: 'L1 事实 → L2 单店模式 → L3 跨店洞察 → L4 行动指引。系统从持续流入的经营数据中自主提炼可复用知识，并以动态质量评分淘汰过时信息。品牌运营经验由此从个人记忆转化为可量化、可传承的企业数字资产。',
    detail: '知识条目自动置信度衰减｜跨门店横向蒸馏｜新知识注入后即时影响下游推理',
  },
  {
    tag: 'Closed-Loop',
    title: '任务闭环与自动验证',
    desc: '系统识别经营异常后，生成带有优先级、责任人与截止时间的结构化行动项。执行状态持续追踪，后续周期自动复核改善效果。超时未处理的行动项逐级上升至管理层。',
    detail: '异常识别 → 行动生成 → 执行追踪 → 效果验证 → 知识回写｜全程无需人工调度',
  },
  {
    tag: 'Agent Swarm',
    title: '多智能体协作架构',
    desc: '系统底层部署专项 Agent 集群：Perception Agent 执行信号采集与清洗，Analysis Agent 完成深度挖掘，Decision Agent 生成经营策略，Execution Agent 追踪任务闭环。各 Agent 异步协作、独立演进，7×24 无间断运行。',
    detail: '基于前沿大语言模型驱动｜单一职责设计｜集群协作涌现超越单体的系统级智能',
  },
];

// ─── SaaS Comparison ───

export const COMPARISON = [
  { dimension: '信息处理', saas: '依赖人工录入，被动存储与展示', us: '自主感知、实时分析、主动推送决策依据' },
  { dimension: '知识管理', saas: '数据沉睡在报表中，人员流动即知识断层', us: '持续蒸馏组织知识，系统自主迭代认知模型' },
  { dimension: '问题响应', saas: '异常发现依赖人工巡检，跟进依赖层级督办', us: '异常自动识别、行动自动派发、结果自动复核' },
  { dimension: '决策支持', saas: '提供图表，解读权交给用户', us: '自然语言交互，基于全量数据输出结论与建议' },
  { dimension: '系统定位', saas: '记录工具——等待被使用', us: '经营导航——主动规划最优路径' },
];

// ─── Role Cards ───

export const ROLES = [
  {
    icon: 'C-Level',
    title: '品牌决策层',
    subtitle: 'Strategic Intelligence',
    pain: '门店真实经营状况层层过滤才能到达决策层，等问题暴露往往已是系统性风险',
    points: [
      '消费者满意度指数与品牌健康度实时监测',
      '跨区域异常信号预警，问题扩散前即可干预',
      '基于全量经营数据的战略决策支持，替代经验推断',
    ],
  },
  {
    icon: 'Regional',
    title: '区域管理层',
    subtitle: 'Standardization Engine',
    pain: '优秀店长的管理经验无法复制，巡店只能抽查，标准化停留在纸面制度',
    points: [
      '多门店核心指标横向对标与差异归因',
      '最佳实践自动识别并向目标门店定向推送',
      '管理方法论沉淀为可量化、可复制的运营标准',
    ],
  },
  {
    icon: 'Store',
    title: '门店执行层',
    subtitle: 'Action Navigation',
    pain: '每天面对大量琐碎信息，不知道哪些问题最该先解决，改善行动缺乏跟踪',
    points: [
      '每日改善优先级清单自动生成与派发',
      '每条行动项附带完整证据链与推荐执行路径',
      '闭环追踪机制确保改善措施落地执行',
    ],
  },
  {
    icon: 'Kitchen',
    title: '出品负责人',
    subtitle: 'Product Optimization',
    pain: '菜品调整凭厨师经验和主观判断，缺少消费者端的直接反馈验证',
    points: [
      '菜品级消费者评价实时聚合与趋势分析',
      '负面信号多维归因：口味、温度、摆盘、份量',
      '消费者验证驱动的菜单迭代机制',
    ],
  },
];

// ─── Closed-Loop Flow Steps (NEW) ───

export const FLOW_STEPS = [
  {
    num: '01',
    tag: 'Capture',
    title: '场景信息采集',
    desc: '一线经营场景信息实时捕获与结构化。支持离线采集、后台同步，零额外设备投入。',
  },
  {
    num: '02',
    tag: 'Analyze',
    title: 'AI 智能分析',
    desc: '多源经营数据深度理解与交叉分析：趋势研判、关键信号提取、消费者画像生成，全程自动化。',
  },
  {
    num: '03',
    tag: 'Insight',
    title: '经营看板',
    desc: '一个页面呈现全貌：菜品排行、消费趋势、改善进度、异常预警。支持日/周/月多维度切换。',
  },
  {
    num: '04',
    tag: 'Action',
    title: '行动闭环',
    desc: 'AI 自动生成改善待办，包含优先级、责任人、截止时间。执行完成自动标记，未完成系统提醒。',
  },
  {
    num: '05',
    tag: 'Verify',
    title: '自动验证',
    desc: '后续采集自动对比前次改善效果，形成闭环验证。改善结果数据化呈现，持续优化有据可循。',
  },
];

// ─── Data Stats Bar (NEW) ───

export const DATA_STATS = [
  { value: '7,700', suffix: '+', label: '经营数据样本' },
  { value: '5,200', suffix: '+', label: '分钟数据处理' },
  { value: '8,900', suffix: '+', label: 'AI 洞察条目' },
  { value: '810', suffix: '', label: '改善行动' },
  { value: '310', suffix: '', label: '会议纪要' },
];

// ─── Proven Capabilities x8 (NEW) ───

export const PROVEN_CAPABILITIES = [
  { num: '01', tag: 'Capture', title: '场景信息采集', desc: '一线经营信息实时捕获与结构化，支持离线采集与后台同步，零额外设备投入。' },
  { num: '02', tag: 'Analysis', title: '智能分析引擎', desc: '多源经营数据深度理解与交叉分析：趋势研判、异常识别、消费者画像，全自动化无需人工标注。' },
  { num: '03', tag: 'Dashboard', title: '经营看板', desc: '菜品排行、消费趋势、改善进度、异常预警，一个页面呈现全天运营状态。' },
  { num: '04', tag: 'Action', title: '行动闭环', desc: 'AI 生成改善待办，含优先级与责任人。执行自动标记，未完成系统提醒。' },
  { num: '05', tag: 'Chat', title: 'AI 智库问答', desc: '自然语言查询经营数据，基于全量分析结果即时响应，替代人工翻报表。' },
  { num: '06', tag: 'Meeting', title: '会议纪要', desc: '餐前会 / 复盘会录音后 AI 自动生成纪要与待办，会议管理全程结构化。' },
  { num: '07', tag: 'Distillation', title: '知识蒸馏', desc: '从全量经营数据中自主提炼品牌运营规律与最佳实践，形成可传承、可量化、持续进化的企业数字资产。' },
  { num: '08', tag: 'Deep Insight', title: '深度洞察', desc: '多维度交叉分析发现隐藏关联，从「问题是什么」到「为什么发生」到「怎么改善」。' },
];

// ─── Value Timeline (NEW) ───

export const VALUE_TIMELINE = [
  {
    tag: 'Now',
    label: '即时价值释放',
    subtitle: '零学习成本，上手即产出',
    borderColor: 'border-primary-400',
    points: [
      '消费者反馈从「转瞬即逝」变为「全量结构化采集」',
      '经营信息实时采集，替代传统人工记录方式',
      '每日运营看板自动生成，关键指标一目了然',
      'AI 自动生成优先级排序的改善清单',
      '会议纪要自动生成，议题追踪结构化',
    ],
  },
  {
    tag: '1 Month',
    label: '趋势浮现',
    subtitle: '数据积累后价值倍增',
    borderColor: 'border-primary-500',
    points: [
      '菜品评价趋势可视化——哪些持续改善、哪些恶化',
      '改善措施效果通过数据闭环验证',
      '回头客偏好模式识别，复购率提升有据可循',
      '多店核心指标横向对比，差距量化',
    ],
  },
  {
    tag: '3 Months',
    label: '企业数字资产成型',
    subtitle: '从工具进化为品牌智能中枢',
    borderColor: 'border-primary-700',
    points: [
      '知识蒸馏引擎自主提炼品牌专属经营规律',
      '新店 / 新人自动继承组织最佳实践，开店即成熟',
      '运营经验从个人记忆升级为永不流失的企业数字资产',
      '知识库持续反哺 AI 模型，系统越用越懂你的品牌',
      '数据壁垒形成——竞争对手无法复制你的组织智慧',
    ],
  },
];
