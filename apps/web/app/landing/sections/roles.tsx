import { ROLES } from '../data';

export function RolesSection() {
  return (
    <section id="roles" className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-50/20 to-transparent">
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
