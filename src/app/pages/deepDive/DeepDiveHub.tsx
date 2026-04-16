import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Shield, User, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function DeepDiveHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = user?.role ?? null;

  const isStudent = location.pathname.includes("/deep-dive/student");
  const isAdmin = location.pathname.includes("/deep-dive/admin");

  const handleLogout = () => {
    logout();
    navigate("/deep-dive/login");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-text">Deep Dive</h1>
            <p className="text-sm text-text-secondary mt-1">
              Advanced planning + analytics tools for students and departments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {role && (
              <span className="text-xs px-2 py-1 rounded-full bg-surface-2 border border-border text-text-secondary">
                Signed in as <span className="font-semibold text-text">{user?.email}</span> ({role})
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-border bg-surface hover:bg-surface-2 flex items-center gap-2"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-2 flex gap-2 w-full md:w-fit">
          <Link
            to="/deep-dive/student"
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              isStudent ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-surface-2"
            }`}
          >
            <User size={16} />
            Student
          </Link>

          {role === "admin" && (
            <Link
              to="/deep-dive/admin"
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                isAdmin ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-surface-2"
              }`}
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
        </div>

        <Outlet />
      </div>
    </div>
  );
}
