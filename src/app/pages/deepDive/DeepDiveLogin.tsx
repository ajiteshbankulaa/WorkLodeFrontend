import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Shield, Sparkles } from "lucide-react";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { useAuth } from "../../context/AuthContext";

export function DeepDiveLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, loading, user, authError } = useAuth();

  const nextPath = useMemo(() => {
    const n = params.get("next");
    return n && (n.startsWith("/admin") || n.startsWith("/plan")) ? n : "/plan";
  }, [params]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      return;
    }

    const target =
      nextPath === "/admin" && user?.role !== "admin"
        ? "/plan"
        : nextPath;

    navigate(target, { replace: true });
  }, [isAuthenticated, loading, navigate, nextPath, user?.role]);

  return (
    <div className="container mx-auto px-4 py-14">
      <div className="max-w-xl mx-auto bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-text">Advanced Workspace Login</h1>
            <p className="text-sm text-text-secondary">Sign in with Google to access the admin workspace and saved planner features.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5">
          <div className="flex items-center gap-2 font-bold text-text">
            <Shield size={16} />
            Google-backed access control
          </div>
          <p className="text-sm text-text-secondary mt-2">
            Student accounts keep using the main planner. Admin accounts also unlock the department analytics workspace.
          </p>
          <GoogleSignInButton className="mt-5 w-full" />
          {authError && <div className="mt-3 text-xs text-red-600">{authError}</div>}
        </div>

        <div className="mt-6 text-xs text-muted">
          Access is now controlled by the backend JWT issued after Google OAuth verification.
        </div>
      </div>
    </div>
  );
}
