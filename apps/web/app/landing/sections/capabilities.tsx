import { CAPABILITIES } from '../data';

export function CapabilitiesSection() {
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
              <p className="text-gray-600 text-sm sm:text-[15px] leading-relaxed mb-3">{cap.desc}</p>
              <p className="text-xs text-gray-400 border-t border-gray-100/60 pt-3">{cap.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
