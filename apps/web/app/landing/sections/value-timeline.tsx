import { VALUE_TIMELINE } from '../data';

export function ValueTimelineSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Value Trajectory
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            价值随数据积累持续放大
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto text-justify sm:text-center">
            系统能力与业务价值随时间呈指数级增长
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {VALUE_TIMELINE.map((phase) => (
            <div key={phase.tag} className={`glass-card rounded-2xl p-6 border-t-4 ${phase.borderColor}`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-primary-50 text-primary-600 text-xs font-bold uppercase tracking-wider">
                  {phase.tag}
                </span>
                <span className="text-sm font-medium text-gray-700">{phase.label}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">{phase.subtitle}</p>
              <ul className="space-y-2.5">
                {phase.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-primary-400 mt-0.5 flex-shrink-0 text-xs">●</span>
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
