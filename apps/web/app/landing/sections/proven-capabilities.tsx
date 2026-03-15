import { PROVEN_CAPABILITIES } from '../data';

export function ProvenCapabilitiesSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Proven Capabilities
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            已验证的核心能力
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            Beta 版已在多家门店实际运营验证，以下每项能力均来自真实生产环境
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {PROVEN_CAPABILITIES.map((cap) => (
            <div key={cap.tag} className="glass-card rounded-2xl p-3.5 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-50 text-primary-600 text-xs font-bold">
                  {cap.num}
                </span>
                <span className="text-xs font-semibold tracking-wider text-primary-500/80 uppercase">
                  {cap.tag}
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-2">{cap.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
