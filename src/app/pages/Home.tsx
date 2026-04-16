import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Search,
  Compass,
  Calendar,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Clock,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/* â”€â”€â”€ Cursorâ€‘reactive gradient orb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 25, stiffness: 150 });
  const springY = useSpring(mouseY, { damping: 25, stiffness: 150 });

  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;
    const handler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };
    container.addEventListener("mousemove", handler);
    return () => container.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none absolute z-0"
      style={{
        x: springX,
        y: springY,
        width: 480,
        height: 480,
        marginLeft: -240,
        marginTop: -240,
        background:
          "radial-gradient(circle, rgba(91,138,245,0.18) 0%, rgba(91,138,245,0.06) 40%, transparent 70%)",
        borderRadius: "50%",
        filter: "blur(40px)",
      }}
    />
  );
}

/* â”€â”€â”€ Floating background orbs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute animate-orb-drift"
        style={{
          top: "10%",
          right: "8%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(91,138,245,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute animate-orb-drift"
        style={{
          top: "55%",
          left: "5%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(229,153,62,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          animationDelay: "-8s",
        }}
      />
      <div
        className="absolute animate-orb-drift"
        style={{
          top: "30%",
          left: "60%",
          width: 180,
          height: 180,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52,199,149,0.1) 0%, transparent 70%)",
          filter: "blur(45px)",
          animationDelay: "-14s",
        }}
      />
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-y"
          style={{
            width: 4 + i * 2,
            height: 4 + i * 2,
            top: `${15 + i * 14}%`,
            left: `${10 + i * 15}%`,
            background: `rgba(91,138,245,${0.15 + i * 0.04})`,
            filter: "blur(1px)",
            animationDelay: `${i * -1.2}s`,
            animationDuration: `${5 + i * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

/* â”€â”€â”€ Magnetic hover card (uses React Router navigate, NOT window.location) â”€â”€â”€ */
function MagneticCard({
  to,
  icon: Icon,
  color,
  bg,
  title,
  desc,
  action,
  delay,
}: {
  to: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  desc: string;
  action: string;
  delay: number;
}) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const scale = useMotionValue(1);
  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 200 });
  const springRotateY = useSpring(rotateY, { damping: 20, stiffness: 200 });
  const springScale = useSpring(scale, { damping: 20, stiffness: 300 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      rotateX.set(-(y / rect.height) * 12);
      rotateY.set((x / rect.width) * 12);
    },
    [rotateX, rotateY]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 800 }}
    >
      <motion.div
        ref={cardRef}
        onClick={() => navigate(to)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { rotateX.set(0); rotateY.set(0); scale.set(1); }}
        onMouseEnter={() => scale.set(1.03)}
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          scale: springScale,
          transformStyle: "preserve-3d",
          cursor: "pointer",
        }}
        className="group rounded-2xl glass-card p-8 shadow-sm hover:nm-raised"
      >
        <div className={`w-14 h-14 rounded-2xl ${bg} ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
          <Icon size={28} />
        </div>
        <h3 className="text-2xl font-bold text-text mb-3">{title}</h3>
        <p className="text-text-secondary mb-6 leading-relaxed">{desc}</p>
        <div className={`flex items-center gap-2 font-bold ${color}`}>
          {action} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* â”€â”€â”€ Hero parallax wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ParallaxHero({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { damping: 30, stiffness: 100 });
  const springY = useSpring(mouseY, { damping: 30, stiffness: 100 });
  const offsetX = useTransform(springX, [0, 1], [-8, 8]);
  const offsetY = useTransform(springY, [0, 1], [-6, 6]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    };
    container.addEventListener("mousemove", handler);
    return () => container.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="relative">
      <motion.div style={{ x: offsetX, y: offsetY }}>{children}</motion.div>
    </div>
  );
}

/* â”€â”€â”€ Main Home (original content + new visual effects) â”€â”€â”€â”€â”€ */
export function Home() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/explore?q=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-32 md:pb-32 px-4">
        <FloatingOrbs />
        <CursorGlow />

        {/* Rotating rings decoration */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="animate-rotate-slow"
            style={{
              width: 900,
              height: 900,
              borderRadius: "50%",
              border: "1px solid var(--color-border)",
              opacity: 0.15,
            }}
          />
          <div
            className="absolute animate-rotate-slow"
            style={{
              width: 600,
              height: 600,
              borderRadius: "50%",
              border: "1px solid var(--color-border)",
              opacity: 0.1,
              animationDirection: "reverse",
              animationDuration: "45s",
            }}
          />
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <ParallaxHero>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full glass-panel text-sm font-bold text-text-secondary"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
              </span>
              Spring 2026 Data Now Live
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black tracking-tight text-text mb-6"
            >
              Find the Real{" "}
              <span
                className="animate-gradient-shift bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-primary) 100%)",
                  backgroundSize: "200% 200%",
                }}
              >
                Workload
              </span>
              .
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Plan your semester with confidence using data sourced directly from students. 
              Know exactly how many hours a course <em>really</em> takes.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <form onSubmit={handleSearch} className="relative group">
                <div className="absolute -inset-1 rounded-[20px] bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 opacity-0 blur-lg transition-opacity duration-500 group-focus-within:opacity-100" />
                <input 
                  type="text"
                  placeholder="Search a course (e.g. CS 101, Linear Algebra)..."
                  className="relative w-full h-16 pl-6 pr-16 rounded-2xl nm-input text-lg outline-none focus:animate-pulse-subtle"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                  type="submit" 
                  aria-label="Search courses"
                  className="absolute right-2 top-2 h-12 w-12 nm-button text-primary rounded-xl flex items-center justify-center"
                >
                  <Search size={24} />
                </button>
              </form>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-text-secondary">
                <span>Popular:</span>
                <button onClick={() => navigate('/explore?q=CS')} className="hover:text-primary underline">Computer Science</button>
                <button onClick={() => navigate('/explore?q=MATH')} className="hover:text-primary underline">Math</button>
                <button onClick={() => navigate('/explore?q=PSYCH')} className="hover:text-primary underline">Psychology</button>
              </div>
            </motion.div>
          </ParallaxHero>
        </div>
      </section>

      {/* Main Features Grid â€” original 3 cards with magnetic tilt effect */}
      <section className="container mx-auto px-4 pb-20">
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15
              }
            }
          }}
        >
          <MagneticCard 
            to="/explore"
            icon={Compass}
            color="text-primary"
            bg="bg-primary/5"
            title="Explore Courses"
            desc="Browse the full catalog with filters for workload, rating, and department."
            action="Browse Catalog"
            delay={0.1}
          />
          <MagneticCard 
            to="/plan"
            icon={Calendar}
            color="text-secondary"
            bg="bg-secondary/5"
            title="Plan Schedule"
            desc="Build your semester schedule and see your total estimated weekly hours."
            action="Start Planning"
            delay={0.2}
          />
          <MagneticCard 
            to="/feedback"
            icon={MessageSquare}
            color="text-emerald-600"
            bg="bg-emerald-50"
            title="Contribute Data"
            desc="Help your peers by anonymously reporting your workload from past courses."
            action="Submit Report"
            delay={0.3}
          />
        </motion.div>
      </section>

      {/* Live Insights Section â€” original content with scroll animations */}
      <section className="bg-surface-2 border-y border-border py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-text mb-2">Live Insights</h2>
              <p className="text-text-secondary">Useful student-facing patterns from reported workload data.</p>
            </div>
            <Link to="/insights" className="hidden md:flex items-center gap-2 text-primary font-bold hover:underline">
              View Student Insights <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stat 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="nm-raised p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 text-rose-500 mb-4 font-bold text-sm uppercase tracking-wide">
                <TrendingUp size={16} /> Heaviest Workload
              </div>
              <ul className="space-y-4">
                <li className="flex justify-between items-center">
                  <span className="font-bold text-text">CHEM 210</span>
                  <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md text-xs font-bold">18.2h</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-bold text-text">CS 450</span>
                  <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md text-xs font-bold">16.5h</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-bold text-text">ARCH 300</span>
                  <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md text-xs font-bold">14.2h</span>
                </li>
              </ul>
            </motion.div>

            {/* Stat 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="nm-raised p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 text-emerald-500 mb-4 font-bold text-sm uppercase tracking-wide">
                <Clock size={16} /> Lightest Electives
              </div>
              <ul className="space-y-4">
                 <li className="flex justify-between items-center">
                  <span className="font-bold text-text">ART 100</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold">3.5h</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-bold text-text">MUS 102</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold">4.0h</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-bold text-text">COMM 101</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold">4.2h</span>
                </li>
              </ul>
            </motion.div>

            {/* Stat 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="nm-raised p-6 rounded-2xl"
            >
              <div className="flex items-center gap-2 text-amber-500 mb-4 font-bold text-sm uppercase tracking-wide">
                <Zap size={16} /> Most Active Depts
              </div>
              <div className="space-y-3">
                <div className="w-full bg-surface-2 rounded-full h-8 overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "85%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute top-0 left-0 h-full bg-amber-100"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-amber-900">
                    <span>Computer Science</span>
                    <span>850 reports</span>
                  </div>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-8 overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "65%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute top-0 left-0 h-full bg-amber-100"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-amber-900">
                    <span>Psychology</span>
                    <span>650 reports</span>
                  </div>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-8 overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "45%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute top-0 left-0 h-full bg-amber-100"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-amber-900">
                    <span>Biology</span>
                    <span>450 reports</span>
                  </div>
                </div>
              </div>
            </motion.div>

             {/* Trust Badge */}
             <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-primary p-6 rounded-2xl shadow-nm-primary text-white flex flex-col justify-between transition-all hover:-translate-y-1"
            >
               <div>
                 <div className="flex items-center gap-2 font-bold mb-2">
                   <ShieldCheck size={20} /> Trusted Data
                 </div>
                 <p className="text-blue-100 text-sm mb-4">
                   Course workload estimates are based on reported hours per week, sample size, and variability so you can judge how trustworthy an estimate really is.
                 </p>
               </div>
               <Link to="/about" className="text-sm font-bold bg-white/10 w-fit px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors">
                 Read Methodology
               </Link>
            </motion.div>

          </div>
        </div>
      </section>
    </div>
  );
}
