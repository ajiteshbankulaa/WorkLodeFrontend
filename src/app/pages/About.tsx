import { Shield, Database, Eye, HelpCircle } from "lucide-react";

export function About() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl space-y-16">
      
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-text tracking-tight">Methodology & Trust</h1>
        <p className="text-xl text-text-secondary">
          How Worklode collects, processes, and protects your data.
        </p>
      </div>

      <div className="space-y-8">
        <Section 
          icon={Database} 
          title="Data Collection" 
          color="text-primary" 
          bg="bg-primary-light"
          border="border-primary/20"
        >
          <p>
            We collect data through end-of-semester surveys distributed to all enrolled students. 
            Questions focus specifically on the time commitment required for lectures, readings, 
            assignments, and project work.
          </p>
          <p className="mt-2 text-sm bg-white/50 p-2 rounded-lg inline-block font-medium">
            <strong>Sample Size Threshold:</strong> We require a minimum of 10 reports before showing public workload aggregates for a course.
          </p>
        </Section>

        <Section 
          icon={Shield} 
          title="Privacy & Anonymity" 
          color="text-emerald-600" 
          bg="bg-emerald-50"
          border="border-emerald-200"
        >
          <p>
            Public course metrics are shown only in aggregate. Individual feedback is not displayed publicly,
            and low-sample courses stay hidden until they meet the publishing threshold.
          </p>
          <p>
            When supporting files are uploaded, access stays tied to the submitting account instead of becoming
            part of the public catalog view.
          </p>
        </Section>

        <Section 
          icon={Eye} 
          title="Interpretation Guide" 
          color="text-amber-600" 
          bg="bg-amber-50"
          border="border-amber-200"
        >
          <p>
            The "Average Weekly Hours" metric represents the mean reported time spent by students.
            Keep in mind that individual experiences vary based on prior knowledge, section structure,
            and working style.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-center">
             <li className="bg-white p-3 rounded border border-amber-100 shadow-sm"><strong className="block text-text">Average</strong> Mean hours per week</li>
             <li className="bg-white p-3 rounded border border-amber-100 shadow-sm"><strong className="block text-text">Variability</strong> Standard deviation of reports</li>
             <li className="bg-white p-3 rounded border border-amber-100 shadow-sm"><strong className="block text-text">Responses</strong> Sample size behind the estimate</li>
          </ul>
        </Section>
      </div>

      <div className="border-t border-border pt-12">
        <h2 className="text-2xl font-bold text-text mb-8 flex items-center gap-2">
          <HelpCircle className="text-muted" /> FAQ
        </h2>
        
        <div className="grid gap-6">
          <FAQItem 
            q="Who verifies this data?" 
            a="The data is community-sourced. We review obvious spam and only publish course-level aggregates once enough reports exist to support a public estimate." 
          />
          <FAQItem 
            q="Can I edit my submission?" 
            a="Not currently. Please review your report carefully before submitting." 
          />
           <FAQItem 
            q="Why isn't my course listed?" 
            a="It likely hasn't met the minimum threshold of 10 responses yet. Encourage your classmates to submit!" 
          />
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, color, bg, border }: any) {
  return (
    <div className={`flex gap-6 p-6 rounded-2xl border ${bg} ${border}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-white shadow-sm ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-xl font-bold text-text mb-3">{title}</h3>
        <div className="text-text-secondary leading-relaxed space-y-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string, a: string }) {
  return (
    <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <h4 className="font-bold text-text mb-2 text-lg">{q}</h4>
      <p className="text-text-secondary leading-relaxed">{a}</p>
    </div>
  );
}
