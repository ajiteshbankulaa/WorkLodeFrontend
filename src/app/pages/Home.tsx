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

    
    </div>
  );
}
