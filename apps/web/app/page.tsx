import Link from 'next/link';

export default function LandingRedirect() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-medium">VARYN</h1>
        <p className="text-muted text-sm">A modern statistical workspace</p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/auth"
            className="rounded-full bg-accent text-background px-6 py-2.5 text-sm font-medium hover:brightness-110 transition"
          >
            Sign In
          </Link>
          <Link
            href="/workspace"
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium hover:border-accent transition"
          >
            Demo Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
