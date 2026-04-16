import { useState, useEffect, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart2,
  Calendar,
  Command,
  Compass,
  Home,
  Menu,
  MessageSquare,
  Palette,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAppearance, AppearancePreset } from "../context/AppearanceContext";
import { CommandPalette } from "./CommandPalette";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const { appearance, appearanceOptions, panelOpen, togglePanel, closePanel, openPanel, setAppearance } = useAppearance();
  const coreThemes = appearanceOptions.filter((option) => option.category === "core");
  const accessibilityThemes = appearanceOptions.filter((option) => option.category === "accessibility");

  const handleGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/explore?q=${encodeURIComponent(globalSearch)}`);
      setGlobalSearch("");
      setIsMobileMenuOpen(false);
    }
  };

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Explore", path: "/explore", icon: Compass },
    { label: "Plan", path: "/plan", icon: Calendar },
    { label: "Feedback", path: "/feedback", icon: MessageSquare },
    { label: "Insights", path: "/insights", icon: BarChart2 },
  ];

  // â”€â”€ Ctrl+K / Cmd+K to open command palette â”€â”€
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-screen flex-col font-sans text-text">
      <header className="sticky top-0 z-50 h-16 glass-panel border-b-0">
        <div className="container mx-auto flex h-full items-center justify-between gap-4 px-4">
          <Link to="/" className="group flex shrink-0 items-center gap-2 text-xl font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-md transition-transform group-hover:scale-105">
              <BarChart2 size={19} />
            </div>
            <span className="text-text">Worklode</span>
          </Link>

          <div className="mx-8 hidden max-w-md flex-1 md:flex">
            <form onSubmit={handleGlobalSearch} className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Search code or title..."
                className="w-full rounded-full nm-input py-2 pl-10 pr-4 text-sm text-text outline-none"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
              />
            </form>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary-light text-primary"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <item.icon size={16} className={isActive ? "text-primary" : "text-muted"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={togglePanel}
            className="hidden items-center gap-2 rounded-full nm-button px-4 py-2 text-sm font-bold text-text-secondary md:inline-flex"
          >
            <Palette size={15} />
            Theme
          </button>

          <button
            type="button"
            className="rounded-md p-2 text-text-secondary hover:bg-surface-2 md:hidden"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-border bg-surface shadow-lg md:hidden"
            >
              <div className="space-y-4 p-4">
                <form onSubmit={handleGlobalSearch}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                      type="text"
                      placeholder="Search courses..."
                      className="w-full rounded-lg border border-transparent bg-surface-2 py-2 pl-10 pr-4 text-text outline-none focus:border-primary"
                      value={globalSearch}
                      onChange={(event) => setGlobalSearch(event.target.value)}
                    />
                  </div>
                </form>

                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 font-medium text-text-secondary hover:bg-surface-2 hover:text-text"
                    >
                      <item.icon size={18} className="text-muted" />
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <button
                  type="button"
                  onClick={() => {
                    togglePanel();
                    setIsMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text"
                >
                  <Palette size={16} />
                  Appearance settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      <footer className="mt-12 border-t border-border bg-surface py-12">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary-light border border-primary/20">
              <BarChart2 size={14} className="text-primary" />
            </div>
            <span className="font-semibold text-text-secondary">Worklode</span>
          </div>

          <div className="flex gap-6 text-sm text-text-secondary">
            <Link to="/about" className="transition-colors hover:text-primary">
              Methodology
            </Link>
            <Link to="/about" className="transition-colors hover:text-primary">
              Privacy
            </Link>
            <Link to="/insights" className="transition-colors hover:text-primary">
              Insights
            </Link>
          </div>

          <div className="text-xs text-muted">Â© 2026 / Student-Sourced Data</div>
        </div>
      </footer>

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close appearance panel"
              onClick={closePanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              className="fixed right-4 top-20 z-50 flex max-h-[78vh] w-[min(92vw,32rem)] flex-col overflow-hidden rounded-[28px] glass-panel shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Appearance</div>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-text">Theme and aesthetic</h2>
                  <p className="mt-1 text-sm text-text-secondary">Compact presets for mood, contrast, and visual comfort.</p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-full border border-border bg-surface p-2 text-text-secondary transition hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto px-5 py-4">
                <ThemeGroup
                  title="Core Themes"
                  note="General mood and palette changes."
                  options={coreThemes}
                  appearance={appearance}
                  setAppearance={setAppearance}
                />
                <ThemeGroup
                  title="Accessibility"
                  note="Presets tuned for stronger contrast, color-vision support, and lower strain."
                  options={accessibilityThemes}
                  appearance={appearance}
                  setAppearance={setAppearance}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onTheme={openPanel}
      />
    </div>
  );
}

function ThemeGroup({
  title,
  note,
  options,
  appearance,
  setAppearance,
}: {
  title: string;
  note: string;
  options: Array<{ id: AppearancePreset; label: string; note: string }>;
  appearance: AppearancePreset;
  setAppearance: (preset: AppearancePreset) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{title}</div>
          <div className="mt-1 text-sm text-text-secondary">{note}</div>
        </div>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-secondary">{options.length}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = appearance === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setAppearance(option.id)}
              className={`group flex w-full flex-col items-start rounded-xl p-3 text-left transition-all ${
                selected
                  ? "bg-primary text-white shadow-nm-primary liquid-glass"
                  : "text-text-secondary hover:bg-surface-2 nm-button"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black leading-5 text-text">{option.label}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{option.note}</div>
                </div>
                {selected && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-primary">
                    <Sparkles size={12} />
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
