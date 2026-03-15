import { FLOW_STEPS, DATA_STATS } from '../data';

export function ClosedLoopSection() {
  return (
    <section id="flow" className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-50/20 to-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Closed-Loop System
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            完整闭环：从信息到行动的全自动链路
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            感知 → 分析 → 洞察 → 行动 → 验证，全程无需人工调度
          </p>
        </div>

        {/* 5-step flow */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.tag} className={`glass-card rounded-2xl p-4 md:p-5 text-center relative${i === FLOW_STEPS.length - 1 ? ' col-span-2 md:col-span-1' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-600 font-bold text-sm">{step.num}</span>
              </div>
              <span className="text-[10px] font-semibold tracking-wider text-primary-400 uppercase">
                {step.tag}
              </span>
              <h3 className="text-base font-semibold text-gray-800 mt-1 mb-2">{step.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              {i < FLOW_STEPS.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 text-gray-300 z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Data stats bar */}
        <div className="mt-10 grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {DATA_STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-center${i >= 3 ? ' col-span-1' : ''}${i === 3 ? ' col-start-1' : ''}`}
            >
              <p className="text-xl sm:text-2xl font-bold text-primary-600">
                {stat.value}
                {stat.suffix && <span className="text-xs sm:text-sm">{stat.suffix}</span>}
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-3">
          数据来自线上生产环境，随门店运营持续增长
        </p>
      </div>
    </section>
  );
}
