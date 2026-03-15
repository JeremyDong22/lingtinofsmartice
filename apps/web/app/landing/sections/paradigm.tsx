import { COMPARISON } from '../data';

export function ParadigmSection() {
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
