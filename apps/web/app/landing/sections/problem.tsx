export function ProblemSection() {
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
      desc: '主观记忆、选择性汇报、偏差——原始信息在传递中不断变形',
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
                { metric: '零衰减', desc: '原始信息完整保留' },
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
