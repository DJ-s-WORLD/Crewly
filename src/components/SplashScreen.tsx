import { cn } from "@/lib/utils";

const SplashScreen = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "min-h-screen w-full flex items-center justify-center px-6",
        "bg-[radial-gradient(1200px_600px_at_10%_0%,rgba(99,102,241,0.45),transparent_55%),radial-gradient(900px_520px_at_95%_10%,rgba(139,92,246,0.35),transparent_60%),linear-gradient(135deg,#0f172a,#020617)]",
        "animate-in fade-in duration-300",
        className
      )}
    >
      <div className="text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 border border-white/10 shadow-xl flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Crewly" className="h-10 w-10 object-contain" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">Crewly</h1>
        <p className="mt-1 text-sm text-white/70">Build Together. Grow Together.</p>
      </div>
    </div>
  );
};

export default SplashScreen;

