import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";

type NamedModule = Record<string, unknown>;

function lazyPage<T extends NamedModule>(
  importer: () => Promise<T>,
  exportName: keyof T
) {
  return async () => {
    const module = await importer();
    return {
      Component: module[exportName] as ComponentType,
    };
  };
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, lazy: lazyPage(() => import("./pages/Home"), "Home") },
      { path: "explore", lazy: lazyPage(() => import("./pages/Explore"), "Explore") },
      { path: "course/:id", lazy: lazyPage(() => import("./pages/CourseProfile"), "CourseProfile") },
      { path: "plan", lazy: lazyPage(() => import("./pages/Plan"), "Plan") },
      { path: "feedback", lazy: lazyPage(() => import("./pages/Feedback"), "Feedback") },
      { path: "insights", lazy: lazyPage(() => import("./pages/Insights"), "Insights") },
      { path: "about", lazy: lazyPage(() => import("./pages/About"), "About") },
      { path: "admin", element: <Navigate to="/insights?workspace=admin" replace /> },
      { path: "deep-dive/login", element: <Navigate to="/insights" replace /> },
      { path: "deep-dive/*", element: <Navigate to="/insights" replace /> },
      { path: "*", Component: () => <div className="p-10 text-center">Page Not Found</div> },
    ],
  },
]);
