import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] text-white px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 text-8xl font-bold font-mono text-[#e94560]">404</div>
        <h1 className="text-2xl font-bold mb-3">Tire Compound Not Found</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          This strategy has pitted and isn&apos;t on track. It may have been retired or the stint data doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#e94560] px-6 py-3 font-semibold text-white hover:bg-[#e94560]/80 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
