import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Calendar, Compass, MessageSquare, Search } from "lucide-react";

const popularSearches = ["CSCI", "MATH", "BIOL", "PSYC"];

const workflows = [
  {
    to: "/explore",
    icon: Compass,
    title: "Explore departments",
    description: "Browse grouped departments, filter courses, and open focused course pages.",
    action: "Browse Explore",
  },
  {
    to: "/plan",
    icon: Calendar,
    title: "Build a plan",
    description: "Compare workload scenarios, outside commitments, conflicts, and total load.",
    action: "Open Planner",
  },
  {
    to: "/feedback",
    icon: MessageSquare,
    title: "Submit feedback",
    description: "Add private workload reports that improve course signals for other students.",
    action: "Contribute Data",
  },
];

export function Home() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore");
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-[var(--hero-gradient)] px-4 py-14 md:py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Worklode</div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-text md:text-6xl">Find courses by real student workload.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary md:text-lg">
              Search for a course, browse departments, and build a semester plan around workload signals students can actually use.
            </p>
          </div>

          <form onSubmit={handleSearch} className="mt-8 max-w-3xl rounded-2xl border border-border bg-white p-2 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by course code, title, or department"
                  className="h-12 w-full rounded-xl border border-transparent bg-surface pl-11 pr-4 text-sm font-medium text-text outline-none transition focus:border-primary focus:bg-white"
                />
              </div>
              <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-hover">
                Search
                <ArrowRight size={16} />
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>Popular:</span>
            {popularSearches.map((query) => (
              <button key={query} type="button" onClick={() => navigate(`/explore?q=${encodeURIComponent(query)}`)} className="rounded-full border border-border bg-white px-3 py-1 font-semibold text-text transition hover:border-primary/30 hover:text-primary">
                {query}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {workflows.map(({ to, icon: Icon, title, description, action }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-primary">
                <Icon size={20} />
              </div>
              <h2 className="mt-5 text-xl font-black text-text">{title}</h2>
              <p className="mt-2 min-h-[72px] text-sm leading-6 text-text-secondary">{description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                {action}
                <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
