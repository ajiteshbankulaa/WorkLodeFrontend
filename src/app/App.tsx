import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { AppearanceProvider } from "./context/AppearanceContext";
import { PlanProvider } from "./context/PlanContext";
import { ProgressProvider } from "./context/ProgressContext";
import { LoadingState } from "./components/PageState";

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <LoadingState label="Loading Worklode..." />
      </div>
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
