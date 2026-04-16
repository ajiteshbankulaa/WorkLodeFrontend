import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";

export function ProtectedDeepDiveRoute({
  allow,
  children,
}: {
  allow: Array<"student" | "admin">;
  children: ReactNode;
}) {
  const location = useLocation();
  const { loading, isAuthenticated, user } = useAuth();
  const role = user?.role ?? null;

  if (loading) {
    return <div className="p-10 text-center text-sm text-text-secondary">Checking your session...</div>;
  }

  const isAllowed = role ? allow.includes(role) : false;

  if (!isAuthenticated) {
    return <Navigate to={`/deep-dive/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isAllowed) {
    return <Navigate to="/deep-dive/student" replace />;
  }

  return <>{children}</>;
}
