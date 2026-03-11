// Landing Page - Public product introduction + beta signup
// v2.0 - Paradigm shift narrative: intelligence-driven operations

'use client';

import { useState, FormEvent } from 'react';
import { getApiUrl } from '@/lib/api';

// ─── Form Types ───

interface SignupForm {
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

const INITIAL_FORM: SignupForm = {
  brand: '', category: '', name: '', position: '', age: '',
  phone: '', store_count: '', annual_revenue: '', city: '', help_text: '',
};

const STORE_COUNT_OPTIONS = ['1-3 家', '4-10 家', '11-30 家', '31-100 家', '100 家以上'];
const REVENUE_OPTIONS = ['500 万以下', '500 万 - 2000 万', '2000 万 - 1 亿', '1 亿 - 5 亿', '5 亿以上'];

// ─── Core Capabilities Data ───

const CAPABILITIES = [
  {
    tag: 'Perception',
    title: '场景语义感知引擎',
    desc: '针对餐饮经营场景构建的专用 NLU 管线。声学降噪、说话人分离、领域意图识别——将非结构化的现场信息转化为可计算的结构化经营信号。',
    detail: '语音 · 文本 · 图像多模态输入｜说话人级别归因｜亚秒级结构化输出',
  },
  {
    tag: 'Distillation',
    title: '四层知识蒸馏架构',
    desc: 'L1 事实 → L2 单店模式 → L3 跨店洞察 → L4 行动指引。系统从持续流入的经营数据中自主提炼可复用知识，并以动态质量评分淘汰过时信息。品牌运营经验由此从个人记忆转化为可量化、可传承的组织资产。',
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
    desc: '系统底层部署专项 Agent 集群：Perception Agent 执行信号采集与清洗，Analysis Agent 完成深度语义挖掘，Decision Agent 生成经营策略，Execution Agent 追踪任务闭环。各 Agent 异步协作、独立演进，7×24 无间断运行。',
    detail: '基于前沿大语言模型驱动｜单一职责设计｜集群协作涌现超越单体的系统级智能',
  },
];

// ─── SaaS Comparison Data ───

const COMPARISON = [
  { dimension: '信息处理', saas: '依赖人工录入，被动存储与展示', us: '自主感知、实时分析、主动推送决策依据' },
  { dimension: '知识管理', saas: '数据沉睡在报表中，人员流动即知识断层', us: '持续蒸馏组织知识，系统自主迭代认知模型' },
  { dimension: '问题响应', saas: '异常发现依赖人工巡检，跟进依赖层级督办', us: '异常自动识别、行动自动派发、结果自动复核' },
  { dimension: '决策支持', saas: '提供图表，解读权交给用户', us: '自然语言交互，基于全量数据输出结论与建议' },
  { dimension: '系统定位', saas: '记录工具——等待被使用', us: '经营导航——主动规划最优路径' },
];

// ─── Role Cards Data ───

const ROLES = [
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

// ─── Components ───

function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 bg-primary-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] right-[10%] w-96 h-96 bg-primary-50/50 rounded-full blur-3xl" />
        <div className="absolute top-[40%] right-[20%] w-48 h-48 bg-teal-100/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-block mb-8">
          <span className="glass-card rounded-full px-5 py-2 text-sm text-primary-600 font-medium tracking-wide">
            Beta Partner Program
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-8">
          餐饮经营的
          <br />
          <span className="text-primary-600">智能决策中枢</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto mb-4 leading-relaxed text-justify sm:text-center">
          当行业还在用表格管理门店，SmartIce 已经构建了
          <br className="hidden md:block" />
          自主学习、自主决策、自主验证的 AI Agent 架构
        </p>
        <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto mb-12 text-justify sm:text-center">
          重新定义餐饮运营范式：从经验驱动到智能驱动
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#paradigm"
            className="inline-flex items-center justify-center px-8 py-3.5 glass-card rounded-xl font-medium text-base text-gray-700 hover:text-primary-600 transition-colors"
          >
            了解详情
          </a>
          <a
            href="#signup"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
          >
            申请内测合作
          </a>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-4 sm:gap-8 max-w-md mx-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Autonomous Learning</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Closed-Loop Execution</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Agent Swarm</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const entropy = [
    {
      label: '后置',
      en: 'Delayed',
      desc: '信息经人工采集、整理、汇报后才到达决策者，滞后数小时甚至数天',
    },
    {
      label: '衰减',
      en: 'Decayed',
      desc: '每经一层传递，细节与上下文逐级丢失，到管理层时仅剩模糊结论',
    },
    {
      label: '失真',
      en: 'Distorted',
      desc: '主观记忆、选择性汇报、语义偏差——原始信息在传递中不断变形',
    },
    {
      label: '低效',
      en: 'Inefficient',
      desc: '发现问题到解决问题的链路冗长，大量管理精力消耗在信息搬运而非决策执行',
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            The Core Problem
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            人工驱动的结构性困境
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            这不是管理能力问题，而是信息架构问题。当业务依赖人工传递信息，信息熵增就是必然结果。
          </p>
        </div>

        {/* Entropy chain */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {entropy.map((item, i) => (
            <div key={item.label} className="relative">
              <div className="glass-card rounded-2xl p-6 h-full border border-red-100/60">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-600 text-xs font-bold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold tracking-wider text-red-500/80 uppercase">
                    {item.en}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">信息{item.label}</h3>
                <p className="text-sm text-gray-500 leading-relaxed text-justify">{item.desc}</p>
              </div>
              {/* Arrow connector (hidden on last item and on mobile) */}
              {i < entropy.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-2.5 -translate-y-1/2 z-10 text-gray-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Resolution */}
        <div className="mt-10 glass-card rounded-2xl p-6 md:p-8 border border-primary-100/60">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase">
                  SmartIce Approach
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                用智能驱动替代人力驱动
              </h3>
              <p className="text-gray-600 text-[15px] leading-relaxed text-justify">
                信息在产生的瞬间即被系统捕获、结构化、分析并分发至对应决策者。
                无人工中转、无层级过滤、无记忆衰减——从源头消除信息熵增。
              </p>
            </div>
            <div className="flex-shrink-0 grid grid-cols-2 gap-3 md:w-72">
              {[
                { metric: '实时', desc: '信息捕获到决策者' },
                { metric: '零衰减', desc: '原始语义完整保留' },
                { metric: '结构化', desc: '非结构信息自动归类' },
                { metric: '闭环', desc: '执行结果自动回溯' },
              ].map((item) => (
                <div key={item.metric} className="text-center px-3 py-2.5 rounded-xl bg-primary-50/60">
                  <p className="text-sm font-bold text-primary-700">{item.metric}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ParadigmSection() {
  return (
    <section id="paradigm" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Paradigm Shift
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            超越 SaaS 的范式
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            传统 SaaS 是被动的信息容器——录入、存储、展示。SmartIce 是主动的决策中枢——感知、推理、执行、验证。
          </p>
        </div>

        <div className="mt-12 glass-card rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-3 text-sm font-semibold border-b border-gray-200/50">
            <div className="px-3 py-3 sm:px-5 sm:py-4 text-gray-500"></div>
            <div className="px-3 py-3 sm:px-5 sm:py-4 text-gray-400 text-center">传统 SaaS</div>
            <div className="px-3 py-3 sm:px-5 sm:py-4 text-primary-600 text-center">SmartIce</div>
          </div>
          {/* Table rows */}
          {COMPARISON.map((row, i) => (
            <div
              key={row.dimension}
              className={`grid grid-cols-3 text-xs sm:text-sm ${i < COMPARISON.length - 1 ? 'border-b border-gray-100/50' : ''}`}
            >
              <div className="px-3 py-3 sm:px-5 sm:py-4 font-medium text-gray-700">{row.dimension}</div>
              <div className="px-3 py-3 sm:px-5 sm:py-4 text-gray-400 text-justify sm:text-center">{row.saas}</div>
              <div className="px-3 py-3 sm:px-5 sm:py-4 text-gray-800 text-justify sm:text-center font-medium">{row.us}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-50/20 to-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Core Architecture
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            核心技术架构
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            感知 · 蒸馏 · 闭环 · 协同——四层架构构成持续进化的智能经营系统
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {CAPABILITIES.map((cap, i) => (
            <div
              key={cap.tag}
              className="glass-card rounded-2xl p-5 sm:p-7 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 text-sm font-bold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-xs font-semibold tracking-wider text-primary-500 uppercase">
                  {cap.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">{cap.title}</h3>
              <p className="text-gray-600 text-[15px] leading-relaxed mb-3 text-justify">{cap.desc}</p>
              <p className="text-xs text-gray-400 border-t border-gray-100/60 pt-3 text-justify">{cap.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RolesSection() {
  return (
    <section id="roles" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Role-Based Intelligence
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            按角色分层的决策引擎
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            不同层级获得与其职责匹配的洞察与行动建议，而非同一张通用报表
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="glass-card rounded-2xl p-5 sm:p-7 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 text-[11px] font-bold tracking-wider uppercase">
                  {role.icon}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{role.title}</h3>
                  <span className="text-xs text-primary-500 font-medium tracking-wide">{role.subtitle}</span>
                </div>
              </div>
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50/60 border border-red-100/80">
                <p className="text-sm text-red-700/70 leading-relaxed text-justify">
                  <span className="font-medium text-red-600/80">传统痛点：</span>{role.pain}
                </p>
              </div>
              <ul className="space-y-2.5">
                {role.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600 text-[15px]">
                    <span className="text-primary-400 mt-1 text-xs">●</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SignupSection() {
  const [form, setForm] = useState<SignupForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: keyof SignupForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.brand.trim() || !form.category.trim() || !form.name.trim() ||
        !form.position.trim() || !form.phone.trim() || !form.city.trim()) {
      setError('请填写所有必填项');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
      setError('请输入有效的 11 位手机号');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        brand: form.brand.trim(),
        category: form.category.trim(),
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
      };
      if (form.age) payload.age = Number(form.age);
      if (form.store_count) payload.store_count = form.store_count;
      if (form.annual_revenue) payload.annual_revenue = form.annual_revenue;
      if (form.help_text.trim()) payload.help_text = form.help_text.trim();

      const res = await fetch(getApiUrl('api/beta-signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `提交失败 (${res.status})`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="signup" className="py-20 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="glass-card rounded-2xl p-10">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">申请已提交</h2>
            <p className="text-gray-500 leading-relaxed">
              我们已收到您的信息，技术团队将在 3 个工作日内与您联系，
              <br />
              共同探讨智能化经营的落地方案。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="signup" className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-50/20 to-transparent">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Beta Program
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            申请内测合作
          </h2>
          <p className="text-gray-500 text-lg text-justify sm:text-center">
            名额有限，我们将优先邀请与产品方向最匹配的品牌伙伴
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="品牌名称" required value={form.brand} onChange={(v) => updateField('brand', v)} placeholder="例：海底捞" />
            <FormField label="品类" required value={form.category} onChange={(v) => updateField('category', v)} placeholder="例：火锅、川菜" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="姓名" required value={form.name} onChange={(v) => updateField('name', v)} placeholder="您的姓名" />
            <FormField label="职位" required value={form.position} onChange={(v) => updateField('position', v)} placeholder="例：品牌总监" />
            <FormField label="年龄" value={form.age} onChange={(v) => updateField('age', v)} placeholder="选填" type="number" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="手机号" required value={form.phone} onChange={(v) => updateField('phone', v)} placeholder="11 位手机号" type="tel" />
            <FormField label="所在城市" required value={form.city} onChange={(v) => updateField('city', v)} placeholder="例：成都" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="门店数量" value={form.store_count} onChange={(v) => updateField('store_count', v)} options={STORE_COUNT_OPTIONS} />
            <SelectField label="年营业收入" value={form.annual_revenue} onChange={(v) => updateField('annual_revenue', v)} options={REVENUE_OPTIONS} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              当前经营中最希望解决的问题？
            </label>
            <textarea
              value={form.help_text}
              onChange={(e) => updateField('help_text', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 placeholder-gray-400 resize-none"
              rows={3}
              placeholder="例：顾客反馈无法系统化利用、多店管理标准难统一..."
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20"
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>

          <p className="text-center text-xs text-gray-400">
            提交即代表您同意我们联系您讨论合作事宜，信息仅用于内测邀请
          </p>
        </form>
      </div>
    </section>
  );
}

// ─── Form Helpers ───

function FormField({
  label, required, value, onChange, placeholder, type = 'text',
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 placeholder-gray-400"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 appearance-none"
      >
        <option value="">请选择</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-10 px-4 text-center border-t border-gray-100/50">
      <div className="text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-500">SmartIce</p>
        <p>© {new Date().getFullYear()} SmartIce Technology. All rights reserved.</p>
        <p>Chengdu, China</p>
      </div>
    </footer>
  );
}

// ─── Page ───

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ProblemSection />
      <ParadigmSection />
      <CapabilitiesSection />
      <RolesSection />
      <SignupSection />
      <Footer />
    </main>
  );
}
