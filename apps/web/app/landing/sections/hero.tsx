export function HeroSection() {
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
          当行业还在用人工驱动管理，SmartIce 已经构建了
          <br className="hidden md:block" />
          自主学习、自主决策、自主验证的 AI Agent 架构
        </p>
        <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto mb-12 text-justify sm:text-center">
          重新定义餐饮运营范式：从经验驱动到智能驱动
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 sm:px-0">
          <a
            href="#flow"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 glass-card rounded-xl font-medium text-base text-gray-700 hover:text-primary-600 transition-colors"
          >
            了解详情
          </a>
          <a
            href="#signup"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
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
