// i18n - Lightweight internationalization without third-party libraries
// v2.0 - Full dictionary for all pages

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Locale = 'zh-CN' | 'en';

const LOCALE_KEY = 'lingtin_lang';
const DEFAULT_LOCALE: Locale = 'zh-CN';

// Flat dictionary keyed by area.key
const dict: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    // BottomNav (manager)
    'nav.chat': '智库',
    'nav.recorder': '录音',
    'nav.dashboard': '看板',
    // AdminBottomNav
    'nav.briefing': '总览',
    'nav.insights': '洞察',
    'nav.meetings': '会议',
    // ChefBottomNav
    'nav.tasks': '待办',
    'nav.dishes': '菜品',
    // UserMenu
    'menu.questionTemplates': '问卷管理',
    'menu.regions': '区域管理',
    'menu.productInsights': '产品洞察',
    'menu.hotwords': '热词管理',
    'menu.submitFeedback': '提交反馈',
    'menu.myFeedback': '我的反馈',
    'menu.guide': '使用指南',
    'menu.logout': '退出登录',
    'menu.switchLang': 'English',
    // Login
    'login.title': 'Lingtin 桌访系统',
    'login.subtitle': '请登录以继续',
    'login.username': '用户名',
    'login.usernamePlaceholder': '请输入用户名',
    'login.password': '密码',
    'login.passwordPlaceholder': '请输入密码',
    'login.submit': '登录',
    'login.submitting': '登录中...',
    'login.testHint': '测试账号: test / test123',
    // Auth errors
    'auth.wrongCredentials': '用户名或密码错误',
    'auth.serverError': '服务器错误，请稍后重试',
    'auth.loginFailed': '登录失败',
    'auth.timeout': '登录超时，请检查网络后重试',
    'auth.networkError': '无法连接服务器，请检查网络',
    'auth.retryFailed': '登录失败，请稍后重试',
    // ChatPage
    'chat.title': 'AI 智库',
    'chat.copy': '复制',
    'chat.retry': '重试',
    'chat.thinking': '思考中',
    'chat.loading': '加载中...',
    'chat.tryAsk': '试试问我',
    'chat.viewBriefing': '查看今日运营简报',
    'chat.stop': '停止',
    'chat.send': '发送',
    'chat.placeholder': '问我任何关于经营的问题...',
    'chat.stoppedThinking': '停止了思考。',
    // Chat page configs - admin
    'chat.admin.title': 'AI 智库',
    'chat.admin.placeholder': '问我任何关于经营的问题...',
    'chat.admin.q1': '本周整体经营情况如何',
    'chat.admin.q2': '哪些菜品需要重点关注',
    'chat.admin.q3': '顾客满意度趋势怎么样',
    'chat.admin.q4': '店长执行情况分析',
    'chat.admin.link1': '查看总览',
    'chat.admin.link2': '深入分析',
    'chat.admin.welcomeTitle': '我是你的 AI 经营顾问',
    'chat.admin.welcomeSubtitle': '汇总了所有门店的经营数据，我能帮你：',
    'chat.admin.cap1': '跨店对比，快速定位需要关注的门店',
    'chat.admin.cap2': '将问题转化为门店待办，推动各店执行',
    'chat.admin.cap3': '跟踪各店改善进度，确认任务是否落地',
    // Chat page configs - manager
    'chat.manager.title': 'AI 智库',
    'chat.manager.placeholder': '问我任何关于桌访的问题...',
    'chat.manager.q1': '帮我优化桌访话术',
    'chat.manager.q2': '最近有哪些需要改进的地方',
    'chat.manager.q3': '哪些菜品需要重点关注',
    'chat.manager.q4': '本周顾客满意度怎么样',
    'chat.manager.link1': '开始桌访',
    'chat.manager.link2': '查看看板',
    'chat.manager.welcomeTitle': '我是你的 AI 运营助手',
    'chat.manager.welcomeSubtitle': '基于你每天的桌访录音，我能帮你：',
    'chat.manager.cap1': '从顾客真实反馈中发现菜品和服务问题',
    'chat.manager.cap2': '自动生成待办事项，驱动每日改善落地',
    'chat.manager.cap3': '追踪任务完成情况，验证改善是否见效',
    // Chat page configs - chef
    'chat.chef.title': 'AI 智库',
    'chat.chef.placeholder': '问我关于菜品和厨房的问题...',
    'chat.chef.q1': '最近哪些菜品被差评了',
    'chat.chef.q2': '有哪些菜品连续好评',
    'chat.chef.q3': '今天备餐需要注意什么',
    'chat.chef.q4': '厨房待办有哪些',
    'chat.chef.link1': '查看厨房待办',
    'chat.chef.link2': '菜品反馈',
    'chat.chef.welcomeTitle': '我是你的 AI 厨房助手',
    'chat.chef.welcomeSubtitle': '追踪了顾客对每道菜的真实评价，我能帮你：',
    'chat.chef.cap1': '精准定位哪道菜出了什么问题',
    'chat.chef.cap2': '将差评转化为备餐任务，驱动厨房改进',
    'chat.chef.cap3': '追踪菜品改善效果，确认问题是否解决',
    // Insights sub-components
    'insights.suggestion': '建议',
    'insights.negative': '差',
    'insights.positive': '好',
    'insights.emptyCustomer': '店长完成桌访录音后，顾客建议和反馈将显示在这里',
    // useChatStream
    'chat.error.requestFailed': '请求失败，请稍后重试',
    'chat.error.cannotRead': '无法读取响应',
    'chat.error.busy': '当前访问人数较多，请稍后重试',
    'chat.error.sorry': '抱歉，',
    'chat.error.unknown': '发生未知错误',
    'chat.tool.queryDb': '查询数据库',
    'chat.tool.thinking': '正在',
    // Briefing
    'briefing.title': '总览',
    'briefing.managingStores': '管理 {0} 家门店',
    'briefing.storesAttention': '{0} 家门店，{1} 件事需要关注',
    'briefing.storesHealthy': '{0} 家门店均运营良好',
    'briefing.satisfaction': '满意度',
    'briefing.coverage': '覆盖率',
    'briefing.stores': '{0} 家门店',
    'briefing.reviewCompletion': '复盘完成',
    'briefing.repeatCustomer': '老客占比',
    'briefing.basedOnData': '基于{0}%数据',
    'briefing.visits': '{0}次桌访',
    'briefing.review': '复盘',
    'briefing.problems': '{0}个问题',
    'briefing.recentReview': '最近复盘记录',
    'briefing.actionItems': '行动事项',
    'briefing.keyDecisions': '关键决定',
    'briefing.noMeeting': '该门店尚未录制复盘会议',
    'briefing.viewDetail': '查看详情 ›',
    'briefing.allGood': '一切正常',
    'briefing.manager': '店长',
    'briefing.customer': '顾客',
    'briefing.score': '{0}分',
    'briefing.greetingMorning': '早安',
    'briefing.greetingAfternoon': '下午好',
    'briefing.greetingEvening': '晚上好',
    'briefing.sentiment.none': '暂无',
    'briefing.sentiment.positive': '满意',
    'briefing.sentiment.neutral': '一般',
    'briefing.sentiment.negative': '不满意',
    // Insights
    'insights.title': '洞察',
    'insights.productTitle': '产品洞察',
    'insights.tabCustomer': '顾客',
    'insights.tabProfile': '画像',
    'insights.tabStaff': '员工反馈',
    // Meetings
    'meetings.title': '会议',
    'meetings.record': '录制',
    'meetings.analyzing': 'AI分析中...',
    'meetings.failed': '处理失败',
    'meetings.actionCount': '{0}项待办',
    'meetings.lastMeeting': '上次 {0}',
    'meetings.noMeeting': '暂无会议',
    'meetings.myMeetings': '我的会议 · {0}条记录',
    'meetings.storesSummary': '{0} 家门店 · {1} 次会议',
    'meetings.storesWithout': '{0} 家未开会',
    'meetings.storesWithoutTitle': '未开会门店 ({0})',
    'meetings.emptyTitle': '当日暂无会议',
    'meetings.emptyBody': '各门店开会后，会议纪要将自动同步到这里',
    'meetings.type.pre_shift': '餐前会',
    'meetings.type.daily_review': '复盘',
    'meetings.type.weekly': '周例会',
    'meetings.type.kitchen': '厨房会议',
    'meetings.type.business': '经营会',
    'meetings.type.manager_sync': '店长沟通',
    'meetings.mins': '{0}分钟',
    'meetings.secs': '{0}秒',
    // Dashboard
    'dashboard.title': '数据看板',
    'dashboard.loading': '加载中...',
    'dashboard.execution': '执行数据',
    'dashboard.visits': '桌访',
    'dashboard.lunch': '午',
    'dashboard.dinner': '晚',
    'dashboard.reviewLabel': '复盘',
    'dashboard.reviewDays': '{0}/{1}天',
    'dashboard.consecutive': '连续复盘',
    'dashboard.satisfactionOverview': '满意度概览',
    'dashboard.satisfied': '满意',
    'dashboard.neutral': '一般',
    'dashboard.unsatisfied': '不满意',
    'dashboard.vsPrevDay': '比昨天',
    'dashboard.noChange': '— 持平',
    'dashboard.noData': '暂无数据',
    'dashboard.customerFeedback': '顾客反馈',
    'dashboard.needsImprovement': '需要改进',
    'dashboard.keepUp': '值得保持',
    'dashboard.tables': '{0}桌',
    'dashboard.allClear': '今日无需特别关注的问题',
    'dashboard.suggestions': '顾客建议',
    'dashboard.last7days': '近 7 天',
    'dashboard.noFeedback': '暂无反馈数据',
    'dashboard.speechUsage': '话术使用',
    'dashboard.aiOptimize': 'AI 优化',
    'dashboard.kitchenResponse': '厨房响应',
    'dashboard.processed': '已处理',
    'dashboard.ignored': '已忽略',
    'dashboard.pending': '待处理',
    'dashboard.chefLabel': '厨师长: ',
    'dashboard.pendingDishes': '{0} 个菜品问题待厨师长处理',
    'dashboard.tableId': '{0}桌',
    'dashboard.managerRole': '店长',
    'dashboard.customerRole': '顾客',
    'dashboard.noDialogue': '暂无对话详情',
    'dashboard.goodExample': '优秀示范',
    'dashboard.canImprove': '可以更好',
    'dashboard.dailyReview': '今日复盘',
    'dashboard.meetingSummary': '会议摘要',
    'dashboard.keyDecisions': '关键决定',
    'dashboard.actionItems': '行动项',
    'dashboard.notReviewed': '当日未复盘',
    'dashboard.notReviewedHint': '今日有 {0} 条需关注反馈尚未复盘',
    'dashboard.goReview': '去录音复盘',
    // DatePicker
    'date.yesterday': '昨日',
    'date.dayBefore': '前天',
    'date.last7days': '近7天',
    'date.last30days': '近30天',
    'date.today': '今日',
    'date.weekdays': '一,二,三,四,五,六,日',
    'date.monthYear': '{0}年{1}月',
    'date.pickEnd': '再点一个日期作为结束',
    'date.weekday.mon': '周一',
    'date.weekday.tue': '周二',
    'date.weekday.wed': '周三',
    'date.weekday.thu': '周四',
    'date.weekday.fri': '周五',
    'date.weekday.sat': '周六',
    'date.weekday.sun': '周日',
    // Recorder
    'recorder.title': '录音',
    'recorder.selectTable': '请先选择桌号',
    'recorder.selectMeetingType': '请先选择会议类型',
    'recorder.retrying': '正在重试...',
    'recorder.retrySuccess': '重试成功',
    'recorder.retryFailed': '重试失败',
    'recorder.visit': '桌访',
    'recorder.meeting': '例会',
    'recorder.todayRecordings': '今日录音',
    'recorder.yesterdayRecordings': '昨日录音',
    'recorder.todayMeetings': '今日例会',
    'recorder.yesterdayMeetings': '昨日例会',
    'recorder.stuckUploads': '{0} 条录音待上传，网络恢复后将自动重试',
    'recorder.retryNow': '立即重试',
    'recorder.stealthMode': '隐蔽模式',
    'recorder.weeklyMeeting': '周例会录音',
    'recorder.weeklyDesc': '将综合本周桌访数据生成周度分析，包括菜品趋势、服务改善点和下周重点',
    'recorder.selectMeetingHint': '请先选择会议类型',
    'recorder.savedRecording': '{0} 桌录音已保存',
    'recorder.analysisComplete': '{0} 桌分析完成',
    'recorder.meetingSaved': '{0}录音已保存',
    'recorder.meetingAnalysisComplete': '{0}分析完成',
    'recorder.recoveredProcessing': '已恢复处理 {0} 条录音',
    'recorder.retryingUploads': '正在重试 {0} 条录音上传',
    'recorder.visitRecoveryComplete': '{0} 桌录音恢复完成',
    'recorder.meetingRecoveryComplete': '例会录音恢复完成',
    'recorder.meetingType.pre_shift': '餐前会',
    'recorder.meetingType.daily_review': '每日复盘',
    'recorder.meetingType.weekly': '周例会',
    'recorder.meetingType.kitchen': '厨房会议',
    'recorder.meetingType.business': '经营会',
    'recorder.meetingType.manager_sync': '店长沟通',
    // Guide page
    'guide.title': '使用指南',
    'guide.latest': '最新',
    'guide.roleLabel.manager': '店长',
    'guide.roleLabel.administrator': '管理层',
    'guide.roleLabel.head_chef': '厨师长',
    'guide.roleLabel.chef': '厨师长',
    'guide.versionCount': '{0}版 · 共 {1} 个版本更新',
    'guide.empty': '暂无与你角色相关的更新记录',
    // WhatsNew Modal
    'whatsNew.gotIt': '知道了',
    // CustomerInsights conversation labels
    'insights.manager': '店长',
    'insights.customer': '顾客',
    'insights.dissatisfied': '不满意',
    'insights.needsAttention': '需关注',
    'insights.satisfied': '满意',
    'insights.emptyTitle': '暂无顾客洞察',
    'insights.table': '{0}桌',
    'insights.tableCount': '{0} 桌',
    'insights.showAll': '查看全部 {0} 条',
    'insights.showAllSuggestions': '查看全部 {0} 条建议',
    'insights.collapse': '收起',
    // Execution Panel
    'execution.todayReview': '今日复盘',
    'execution.yesterdayReview': '昨日复盘',
    'execution.yesterdayExecution': '昨日执行状态',
    'execution.notDone': '未完成',
    'execution.done': '已完成',
    'execution.goRecord': '未完成 · 去录制 ›',
    'execution.goReview': '去复盘 ›',
    'execution.pendingActions': '条行动建议 ›',
    'execution.pendingAdvice': '条待办建议 ›',
    'execution.allDone': '全部完成',
    'execution.reviewCount': '复盘 {0}/{1}',
    'execution.pendingCount': '待处理 {0}条',
    'execution.pending': '待处理',
    'execution.noProblems': '暂无问题',
    'execution.viewDetail': '查看详情',
  },
  'en': {
    // BottomNav (manager)
    'nav.chat': 'Chat',
    'nav.recorder': 'Record',
    'nav.dashboard': 'Dashboard',
    // AdminBottomNav
    'nav.briefing': 'Briefing',
    'nav.insights': 'Insights',
    'nav.meetings': 'Meetings',
    // ChefBottomNav
    'nav.tasks': 'Tasks',
    'nav.dishes': 'Dishes',
    // UserMenu
    'menu.questionTemplates': 'Templates',
    'menu.regions': 'Regions',
    'menu.productInsights': 'Product Insights',
    'menu.hotwords': 'Hotwords',
    'menu.submitFeedback': 'Feedback',
    'menu.myFeedback': 'My Feedback',
    'menu.guide': 'Guide',
    'menu.logout': 'Sign Out',
    'menu.switchLang': '中文',
    // Login
    'login.title': 'Lingtin Visit System',
    'login.subtitle': 'Please sign in to continue',
    'login.username': 'Username',
    'login.usernamePlaceholder': 'Enter username',
    'login.password': 'Password',
    'login.passwordPlaceholder': 'Enter password',
    'login.submit': 'Sign In',
    'login.submitting': 'Signing in...',
    'login.testHint': 'Test account: test / test123',
    // Auth errors
    'auth.wrongCredentials': 'Invalid username or password',
    'auth.serverError': 'Server error, please try again later',
    'auth.loginFailed': 'Login failed',
    'auth.timeout': 'Login timed out, please check your network',
    'auth.networkError': 'Cannot connect to server, please check your network',
    'auth.retryFailed': 'Login failed, please try again later',
    // ChatPage
    'chat.title': 'AI Chat',
    'chat.copy': 'Copy',
    'chat.retry': 'Retry',
    'chat.thinking': 'Thinking',
    'chat.loading': 'Loading...',
    'chat.tryAsk': 'Try asking me',
    'chat.viewBriefing': 'View today\'s briefing',
    'chat.stop': 'Stop',
    'chat.send': 'Send',
    'chat.placeholder': 'Ask me anything about operations...',
    'chat.stoppedThinking': 'Stopped thinking.',
    // Chat page configs - admin
    'chat.admin.title': 'AI Chat',
    'chat.admin.placeholder': 'Ask me anything about operations...',
    'chat.admin.q1': 'How is overall business this week',
    'chat.admin.q2': 'Which dishes need attention',
    'chat.admin.q3': 'Customer satisfaction trends',
    'chat.admin.q4': 'Manager execution analysis',
    'chat.admin.link1': 'View Briefing',
    'chat.admin.link2': 'Deep Analysis',
    'chat.admin.welcomeTitle': 'Your AI Business Advisor',
    'chat.admin.welcomeSubtitle': 'I have all your stores\' data. I can help you:',
    'chat.admin.cap1': 'Compare stores, quickly identify those needing attention',
    'chat.admin.cap2': 'Turn issues into store action items, drive execution',
    'chat.admin.cap3': 'Track improvement progress across stores',
    // Chat page configs - manager
    'chat.manager.title': 'AI Chat',
    'chat.manager.placeholder': 'Ask me about visits...',
    'chat.manager.q1': 'Help me improve visit scripts',
    'chat.manager.q2': 'What needs improvement recently',
    'chat.manager.q3': 'Which dishes need attention',
    'chat.manager.q4': 'Customer satisfaction this week',
    'chat.manager.link1': 'Start Visit',
    'chat.manager.link2': 'View Dashboard',
    'chat.manager.welcomeTitle': 'Your AI Operations Assistant',
    'chat.manager.welcomeSubtitle': 'Based on your daily visit recordings, I can help you:',
    'chat.manager.cap1': 'Discover dish and service issues from real customer feedback',
    'chat.manager.cap2': 'Auto-generate action items to drive daily improvements',
    'chat.manager.cap3': 'Track task completion, verify if improvements are working',
    // Chat page configs - chef
    'chat.chef.title': 'AI Chat',
    'chat.chef.placeholder': 'Ask me about dishes and kitchen...',
    'chat.chef.q1': 'Which dishes got complaints recently',
    'chat.chef.q2': 'Which dishes are consistently praised',
    'chat.chef.q3': 'What to watch for in today\'s prep',
    'chat.chef.q4': 'What are the kitchen tasks',
    'chat.chef.link1': 'Kitchen Tasks',
    'chat.chef.link2': 'Dish Feedback',
    'chat.chef.welcomeTitle': 'Your AI Kitchen Assistant',
    'chat.chef.welcomeSubtitle': 'Tracking real customer reviews for every dish. I can help you:',
    'chat.chef.cap1': 'Pinpoint exactly which dish has what problem',
    'chat.chef.cap2': 'Turn complaints into prep tasks, drive kitchen improvements',
    'chat.chef.cap3': 'Track dish improvement results, verify if issues are resolved',
    // Insights sub-components
    'insights.suggestion': 'suggestions',
    'insights.negative': 'negative',
    'insights.positive': 'positive',
    'insights.emptyCustomer': 'Customer feedback will appear here after managers complete visit recordings',
    // useChatStream
    'chat.error.requestFailed': 'Request failed, please try again',
    'chat.error.cannotRead': 'Cannot read response',
    'chat.error.busy': 'Server is busy, please try again later',
    'chat.error.sorry': 'Sorry, ',
    'chat.error.unknown': 'An unknown error occurred',
    'chat.tool.queryDb': 'Querying database',
    'chat.tool.thinking': 'Running ',
    // Briefing
    'briefing.title': 'Briefing',
    'briefing.managingStores': 'Managing {0} stores',
    'briefing.storesAttention': '{0} stores, {1} items need attention',
    'briefing.storesHealthy': 'All {0} stores operating well',
    'briefing.satisfaction': 'Satisfaction',
    'briefing.coverage': 'Coverage',
    'briefing.stores': '{0} stores',
    'briefing.reviewCompletion': 'Review Done',
    'briefing.repeatCustomer': 'Repeat Rate',
    'briefing.basedOnData': 'Based on {0}% data',
    'briefing.visits': '{0} visits',
    'briefing.review': 'Review',
    'briefing.problems': '{0} issues',
    'briefing.recentReview': 'Recent Review',
    'briefing.actionItems': 'Action Items',
    'briefing.keyDecisions': 'Key Decisions',
    'briefing.noMeeting': 'No review meeting recorded yet',
    'briefing.viewDetail': 'View Details ›',
    'briefing.allGood': 'All Good',
    'briefing.manager': 'Manager',
    'briefing.customer': 'Customer',
    'briefing.score': '{0}',
    'briefing.greetingMorning': 'Good morning',
    'briefing.greetingAfternoon': 'Good afternoon',
    'briefing.greetingEvening': 'Good evening',
    'briefing.sentiment.none': 'N/A',
    'briefing.sentiment.positive': 'Satisfied',
    'briefing.sentiment.neutral': 'Neutral',
    'briefing.sentiment.negative': 'Unsatisfied',
    // Insights
    'insights.title': 'Insights',
    'insights.productTitle': 'Product Insights',
    'insights.tabCustomer': 'Customers',
    'insights.tabProfile': 'Profiles',
    'insights.tabStaff': 'Staff Feedback',
    // Meetings
    'meetings.title': 'Meetings',
    'meetings.record': 'Record',
    'meetings.analyzing': 'AI analyzing...',
    'meetings.failed': 'Failed',
    'meetings.actionCount': '{0} actions',
    'meetings.lastMeeting': 'Last: {0}',
    'meetings.noMeeting': 'No meetings',
    'meetings.myMeetings': 'My Meetings · {0} records',
    'meetings.storesSummary': '{0} stores · {1} meetings',
    'meetings.storesWithout': '{0} stores not met',
    'meetings.storesWithoutTitle': 'Stores without meetings ({0})',
    'meetings.emptyTitle': 'No meetings today',
    'meetings.emptyBody': 'Meeting notes will sync here after stores hold meetings',
    'meetings.type.pre_shift': 'Pre-shift',
    'meetings.type.daily_review': 'Daily Review',
    'meetings.type.weekly': 'Weekly',
    'meetings.type.kitchen': 'Kitchen',
    'meetings.type.business': 'Business',
    'meetings.type.manager_sync': 'Manager Sync',
    'meetings.mins': '{0} min',
    'meetings.secs': '{0} sec',
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.loading': 'Loading...',
    'dashboard.execution': 'Execution',
    'dashboard.visits': 'Visits',
    'dashboard.lunch': 'L',
    'dashboard.dinner': 'D',
    'dashboard.reviewLabel': 'Review',
    'dashboard.reviewDays': '{0}/{1} days',
    'dashboard.consecutive': 'Consecutive',
    'dashboard.satisfactionOverview': 'Satisfaction Overview',
    'dashboard.satisfied': 'Satisfied',
    'dashboard.neutral': 'Neutral',
    'dashboard.unsatisfied': 'Unsatisfied',
    'dashboard.vsPrevDay': 'vs yesterday',
    'dashboard.noChange': '— no change',
    'dashboard.noData': 'No data',
    'dashboard.customerFeedback': 'Customer Feedback',
    'dashboard.needsImprovement': 'Needs Improvement',
    'dashboard.keepUp': 'Keep It Up',
    'dashboard.tables': '{0} tables',
    'dashboard.allClear': 'No issues to address today',
    'dashboard.suggestions': 'Suggestions',
    'dashboard.last7days': 'Last 7 days',
    'dashboard.noFeedback': 'No feedback data',
    'dashboard.speechUsage': 'Speech Usage',
    'dashboard.aiOptimize': 'AI Optimize',
    'dashboard.kitchenResponse': 'Kitchen Response',
    'dashboard.processed': 'Processed',
    'dashboard.ignored': 'Ignored',
    'dashboard.pending': 'Pending',
    'dashboard.chefLabel': 'Chef: ',
    'dashboard.pendingDishes': '{0} dish issues pending chef review',
    'dashboard.tableId': 'Table {0}',
    'dashboard.managerRole': 'Manager',
    'dashboard.customerRole': 'Customer',
    'dashboard.noDialogue': 'No dialogue details',
    'dashboard.goodExample': 'Good Example',
    'dashboard.canImprove': 'Can Improve',
    'dashboard.dailyReview': 'Daily Review',
    'dashboard.meetingSummary': 'Meeting Summary',
    'dashboard.keyDecisions': 'Key Decisions',
    'dashboard.actionItems': 'Action Items',
    'dashboard.notReviewed': 'Not Reviewed',
    'dashboard.notReviewedHint': '{0} issues need review today',
    'dashboard.goReview': 'Start Review',
    // DatePicker
    'date.yesterday': 'Yesterday',
    'date.dayBefore': '2 days ago',
    'date.last7days': 'Last 7 days',
    'date.last30days': 'Last 30 days',
    'date.today': 'Today',
    'date.weekdays': 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    'date.monthYear': '{1}/{0}',
    'date.pickEnd': 'Pick an end date',
    'date.weekday.mon': 'Mon',
    'date.weekday.tue': 'Tue',
    'date.weekday.wed': 'Wed',
    'date.weekday.thu': 'Thu',
    'date.weekday.fri': 'Fri',
    'date.weekday.sat': 'Sat',
    'date.weekday.sun': 'Sun',
    // Recorder
    'recorder.title': 'Record',
    'recorder.selectTable': 'Please select a table first',
    'recorder.selectMeetingType': 'Please select a meeting type first',
    'recorder.retrying': 'Retrying...',
    'recorder.retrySuccess': 'Retry successful',
    'recorder.retryFailed': 'Retry failed',
    'recorder.visit': 'Visit',
    'recorder.meeting': 'Meeting',
    'recorder.todayRecordings': 'Today\'s Recordings',
    'recorder.yesterdayRecordings': 'Yesterday\'s Recordings',
    'recorder.todayMeetings': 'Today\'s Meetings',
    'recorder.yesterdayMeetings': 'Yesterday\'s Meetings',
    'recorder.stuckUploads': '{0} recordings pending upload, will auto-retry when online',
    'recorder.retryNow': 'Retry Now',
    'recorder.stealthMode': 'Stealth Mode',
    'recorder.weeklyMeeting': 'Weekly Meeting',
    'recorder.weeklyDesc': 'Generate weekly analysis from visit data including dish trends, service improvements, and next week priorities',
    'recorder.selectMeetingHint': 'Please select a meeting type first',
    'recorder.savedRecording': 'Table {0} recording saved',
    'recorder.analysisComplete': 'Table {0} analysis complete',
    'recorder.meetingSaved': '{0} recording saved',
    'recorder.meetingAnalysisComplete': '{0} analysis complete',
    'recorder.recoveredProcessing': 'Recovered {0} recordings',
    'recorder.retryingUploads': 'Retrying {0} recording uploads',
    'recorder.visitRecoveryComplete': 'Table {0} recording recovered',
    'recorder.meetingRecoveryComplete': 'Meeting recording recovered',
    'recorder.meetingType.pre_shift': 'Pre-shift',
    'recorder.meetingType.daily_review': 'Daily Review',
    'recorder.meetingType.weekly': 'Weekly',
    'recorder.meetingType.kitchen': 'Kitchen',
    'recorder.meetingType.business': 'Business',
    'recorder.meetingType.manager_sync': 'Manager Sync',
    // Guide page
    'guide.title': 'User Guide',
    'guide.latest': 'Latest',
    'guide.roleLabel.manager': 'Manager',
    'guide.roleLabel.administrator': 'Admin',
    'guide.roleLabel.head_chef': 'Head Chef',
    'guide.roleLabel.chef': 'Head Chef',
    'guide.versionCount': '{0} · {1} versions',
    'guide.empty': 'No updates for your role yet',
    // WhatsNew Modal
    'whatsNew.gotIt': 'Got it',
    // CustomerInsights conversation labels
    'insights.manager': 'Mgr',
    'insights.customer': 'Guest',
    'insights.dissatisfied': 'Dissatisfied',
    'insights.needsAttention': 'Needs Attention',
    'insights.satisfied': 'Satisfied',
    'insights.emptyTitle': 'No Customer Insights',
    'insights.table': 'Table {0}',
    'insights.tableCount': '{0} tables',
    'insights.showAll': 'Show all {0}',
    'insights.showAllSuggestions': 'Show all {0} suggestions',
    'insights.collapse': 'Collapse',
    // Execution Panel
    'execution.todayReview': 'Today\'s Review',
    'execution.yesterdayReview': 'Yesterday\'s Review',
    'execution.yesterdayExecution': 'Yesterday\'s Execution',
    'execution.notDone': 'Not done',
    'execution.done': 'Done',
    'execution.goRecord': 'Not done · Record ›',
    'execution.goReview': 'Review ›',
    'execution.pendingActions': ' actions ›',
    'execution.pendingAdvice': ' pending actions ›',
    'execution.allDone': 'All done',
    'execution.reviewCount': 'Review {0}/{1}',
    'execution.pendingCount': '{0} pending',
    'execution.pending': 'Pending',
    'execution.noProblems': 'No issues',
    'execution.viewDetail': 'View detail',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
      if (stored && (stored === 'zh-CN' || stored === 'en')) {
        setLocaleState(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Update html lang attribute when locale changes
  useEffect(() => {
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en';
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_KEY, newLocale);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const t = useCallback((key: string, ...args: (string | number)[]): string => {
    let text = dict[locale][key] || dict[DEFAULT_LOCALE][key] || key;
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, String(arg));
    });
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Hook for components inside I18nProvider */
export function useT() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useT must be used within an I18nProvider');
  }
  return context;
}

/** Utility for non-component code — reads localStorage directly */
export function getLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored === 'zh-CN' || stored === 'en') return stored;
  } catch {
    // Ignore
  }
  return DEFAULT_LOCALE;
}

/** Translate a key outside of React components */
export function tStatic(key: string, ...args: (string | number)[]): string {
  const locale = getLocale();
  let text = dict[locale][key] || dict[DEFAULT_LOCALE][key] || key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, String(arg));
  });
  return text;
}
