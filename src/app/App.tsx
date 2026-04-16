import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { AppearanceProvider } from "./context/AppearanceContext";
import { PlanProvider } from "./context/PlanContext";
import { ProgressProvider } from "./context/ProgressContext";

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-text-secondary">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <PlanProvider>
          <ProgressProvider>
            <RouterProvider router={router} fallbackElement={<RouteLoading />} />
          </ProgressProvider>
        </PlanProvider>
      </AuthProvider>
    </AppearanceProvider>
  );
}
