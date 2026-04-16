import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Compass,
  Calendar,
  Target,
  MessageSquare,
  BarChart2,
  Palette,
  Info,
  Command,
} from "lucide-react";

const ACTIONS = [
  { id: "home", label: "Go to Home", icon: "🏠", path: "/" },
  { id: "explore", label: "Explore Courses", icon: "🧭", path: "/explore" },
  { id: "plan", label: "Open Planner", icon: "📅", path: "/plan" },
  { id: "progress", label: "View Progress", icon: "🎯", path: "/progress" },
  { id: "feedback", label: "Submit Feedback", icon: "💬", path: "/feedback" },
  { id: "insights", label: "Open Insights", icon: "📊", path: "/insights" },
  { id: "about", label: "About WorkLode", icon: "ℹ️", path: "/about" },
  { id: "search-cs", label: "Search: Computer Science", icon: "🔍", path: "/explore?q=CSCI" },
  { id: "search-math", label: "Search: Mathematics", icon: "🔍", path: "/explore?q=MATH" },
  { id: "search-bio", label: "Search: Biology", icon: "🔍", path: "/explore?q=BIOL" },
  { id: "search-econ", label: "Search: Economics", icon: "🔍", path: "/explore?q=ECON" },
];

export function CommandPalette({
  open,
  onClose,
  onTheme,
}: {
  open: boolean;
  onClose: () => void;
  onTheme: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? ACTIONS.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.id.includes(query.toLowerCase())
      )
    : ACTIONS;

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const runAction = useCallback(
    (action: (typeof ACTIONS)[number]) => {
      if (action.id === "theme") {
        onTheme();
      } else {
        navigate(action.path);
      }
      onClose();
    },
    [navigate, onClose, onTheme]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        runAction(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, runAction, onClose]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-[15vh] z-[61] w-[min(95vw,540px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search actions, pages, or courses..."
                className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
              <kbd className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-text-secondary">
                  No matching actions found.
                </div>
              )}
              {filtered.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAction(action)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? "bg-primary-light text-primary"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="font-medium">{action.label}</span>
                </button>
              ))}

              {/* Static theme action */}
              <button
                type="button"
                onClick={() => {
                  onTheme();
                  onClose();
                }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text"
              >
                <span className="text-base">🎨</span>
                <span className="font-medium">Change Theme</span>
              </button>
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>esc Close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
