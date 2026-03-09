// Route loading skeleton — shows instantly during page transitions
// Prevents "frozen page" feel when navigating between tabs

export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="island-page-top island-page-bottom px-4 space-y-3">
        <div className="glass-card rounded-2xl h-28 animate-pulse" />
        <div className="glass-card rounded-2xl h-44 animate-pulse opacity-60" />
        <div className="glass-card rounded-2xl h-32 animate-pulse opacity-40" />
      </div>
    </div>
  );
}
