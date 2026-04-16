import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function GoogleSignInButton({
  className = "",
  label = "Continue with Google",
}: {
  className?: string;
  label?: string;
}) {
  const { initializeGoogleAuth, signInWithGoogle, signingIn, googleLoading, googleReady, googleEnabled } = useAuth();

  useEffect(() => {
    void initializeGoogleAuth().catch(() => undefined);
  }, [initializeGoogleAuth]);

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      disabled={googleLoading || signingIn || (!googleEnabled && !googleReady)}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
        G
      </span>
      {googleLoading ? "Preparing Google..." : signingIn ? "Opening Google..." : label}
    </button>
  );
}
