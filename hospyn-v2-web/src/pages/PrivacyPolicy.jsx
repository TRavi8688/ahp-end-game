import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Database, UserCheck, Mail, Phone, Clock, AlertCircle, ChevronRight } from 'lucide-react';

const Section = ({ icon: Icon, title, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className="glass-card p-8 mb-6 group hover:border-primary/30 transition-all duration-500"
  >
    <div className="flex items-center gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="text-primary" size={18} />
      </div>
      <h2 className="text-xl font-black outfit text-white tracking-tight">{title}</h2>
    </div>
    <div className="text-slate-400 text-sm leading-relaxed space-y-3 pl-14">
      {children}
    </div>
  </motion.div>
);

const TableRow = ({ left, right }) => (
  <div className="grid grid-cols-2 gap-4 py-3 border-b border-white/5 last:border-0">
    <span className="text-slate-300 font-medium text-sm">{left}</span>
    <span className="text-slate-400 text-sm">{right}</span>
  </div>
);

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="neural-grid fixed inset-0 z-0" />

      {/* Back to home */}
      <div className="relative z-10 pt-8 px-6 max-w-4xl mx-auto">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors"
        >
          <ChevronRight size={12} className="rotate-180" /> Back to Hospain
        </a>
      </div>

      <div className="relative z-10 pt-12 pb-32 px-6 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black tracking-[0.4em] text-primary uppercase mb-8">
            <Shield size={10} /> DPDP Act 2023 Compliant
          </div>
          <h1 className="text-5xl md:text-6xl font-black outfit leading-tight tracking-tighter mb-6 premium-gradient-text">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Hospain Technologies Pvt Ltd is committed to protecting the privacy and security of your personal and health data. This policy explains what we collect, why, and how we safeguard it under the <strong className="text-slate-300">Digital Personal Data Protection Act, 2023</strong>.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-slate-600">
            <Clock size={12} />
            <span>Last updated: June 2026 &nbsp;·&nbsp; Effective: June 1, 2026</span>
          </div>
        </motion.div>

        {/* Sections */}
        <Section icon={Database} title="1. Data We Collect" delay={0.05}>
          <p>We collect the following categories of personal and health data when you use Hospain:</p>
          <div className="mt-4 rounded-xl border border-white/5 overflow-hidden bg-white/2">
            <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>Data Category</span>
              <span>Purpose</span>
            </div>
            <div className="px-4">
              <TableRow left="Mobile number, name, date of birth" right="Account creation & identity verification" />
              <TableRow left="Health records, prescriptions, lab reports" right="Medical history, continuity of care" />
              <TableRow left="Device location (GPS)" right="Nearby clinic/hospital discovery" />
              <TableRow left="Appointment history" right="Booking management & reminders" />
              <TableRow left="Payment details (tokenised)" right="Transaction processing via RBI-compliant gateway" />
              <TableRow left="Device identifiers, usage logs" right="App security, fraud prevention, analytics" />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Sensitive personal data (health records) is processed only with your explicit consent and is never sold to third parties.
          </p>
        </Section>

        <Section icon={Eye} title="2. Purpose of Processing" delay={0.1}>
          <ul className="space-y-2">
            {[
              'Facilitating appointment booking between patients and healthcare providers',
              'Providing AI-powered health assistance and symptom triage (informational only, not a substitute for professional medical advice)',
              'Enabling doctors and hospitals to access authorised patient records',
              'Sending appointment reminders, health alerts, and platform notifications',
              'Complying with applicable Indian healthcare and data protection laws',
              'Improving platform features through anonymised, aggregated analytics',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Clock} title="3. Data Retention" delay={0.15}>
          <p>We retain your data only as long as necessary for the stated purposes or as required by law:</p>
          <div className="mt-4 rounded-xl border border-white/5 overflow-hidden bg-white/2">
            <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>Data Type</span>
              <span>Retention Period</span>
            </div>
            <div className="px-4">
              <TableRow left="Electronic health records" right="7 years (per Clinical Establishments Act & IT Rules)" />
              <TableRow left="Minor patient records" right="Until age 18 + 7 years" />
              <TableRow left="Payment transaction logs" right="8 years (per RBI guidelines)" />
              <TableRow left="Account & profile data" right="Duration of account + 3 years post-deletion" />
              <TableRow left="Usage & device logs" right="90 days" />
            </div>
          </div>
          <p className="mt-4">
            After the applicable retention period, data is securely deleted or irreversibly anonymised.
          </p>
        </Section>

        <Section icon={UserCheck} title="4. Your Rights as a Data Principal" delay={0.2}>
          <p>Under the DPDP Act 2023, you have the following rights regarding your personal data:</p>
          <ul className="space-y-3 mt-2">
            {[
              { title: 'Right to Access', desc: 'Request a summary of personal data we hold about you and how it is being processed.' },
              { title: 'Right to Correction', desc: 'Request correction of inaccurate or incomplete personal data.' },
              { title: 'Right to Erasure', desc: 'Request deletion of your personal data, subject to legal retention obligations.' },
              { title: 'Right to Grievance Redressal', desc: 'Lodge a complaint with our Grievance Officer within a reasonable time. We will respond within 30 days.' },
              { title: 'Right to Nominate', desc: 'Nominate another individual to exercise your rights in the event of death or incapacity.' },
              { title: 'Right to Withdraw Consent', desc: 'Withdraw consent at any time for non-essential processing. This will not affect lawfulness of prior processing.' },
            ].map((item, i) => (
              <li key={i} className="rounded-lg bg-white/3 border border-white/5 px-4 py-3">
                <p className="text-white font-bold text-sm mb-1">{item.title}</p>
                <p className="text-slate-400 text-xs">{item.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs">
            To exercise any of the above rights, email us at <a href="mailto:privacy@hospain.in" className="text-primary hover:underline">privacy@hospain.in</a>.
          </p>
        </Section>

        <Section icon={Shield} title="5. Data Security" delay={0.25}>
          <ul className="space-y-2">
            {[
              'All data is encrypted in transit (TLS 1.3) and at rest (AES-256)',
              'Health records are stored in HIPAA-aligned, ISO 27001 certified cloud infrastructure',
              'Access to patient data is role-based; only authorised healthcare providers can access your records',
              'Regular third-party security audits and penetration testing',
              'Breach notification to Data Protection Board of India within 72 hours of discovery',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={AlertCircle} title="6. Third-Party Sharing" delay={0.3}>
          <p>We do not sell your personal data. We share it only with:</p>
          <ul className="space-y-2 mt-2">
            {[
              'Healthcare providers (doctors, hospitals) you explicitly engage with on the platform',
              'Payment processors operating under RBI-compliant frameworks',
              'Cloud infrastructure providers under strict data processing agreements',
              'Regulatory authorities and law enforcement when legally mandated',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3">All third-party processors are bound by contractual data protection obligations aligned with DPDP Act 2023.</p>
        </Section>

        {/* Grievance Officer Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
          className="glass-card p-8 mb-6 border-primary/20"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Mail className="text-primary" size={18} />
            </div>
            <h2 className="text-xl font-black outfit text-white tracking-tight">7. Data Fiduciary & Grievance Officer</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 pl-14">
            <div className="rounded-xl bg-white/3 border border-white/5 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Data Fiduciary</p>
              <p className="text-white font-bold">Hospain Technologies Pvt Ltd</p>
              <p className="text-slate-400 text-sm mt-1">Hyderabad, Telangana, India</p>
              <div className="mt-3 space-y-1">
                <a href="mailto:privacy@hospain.in" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail size={13} /> privacy@hospain.in
                </a>
              </div>
            </div>
            <div className="rounded-xl bg-white/3 border border-white/5 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Grievance Officer</p>
              <p className="text-white font-bold">Chief Privacy Officer</p>
              <p className="text-slate-400 text-sm mt-1">Hospain Technologies Pvt Ltd<br />Hyderabad, Telangana — 500001</p>
              <div className="mt-3 space-y-1">
                <a href="mailto:grievance@hospain.in" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail size={13} /> grievance@hospain.in
                </a>
                <a href="tel:+914040001234" className="flex items-center gap-2 text-sm text-slate-400 hover:text-primary transition-colors">
                  <Phone size={13} /> +91 40 4000 1234
                </a>
              </div>
              <p className="text-xs text-slate-600 mt-3">Response within 30 days of receipt</p>
            </div>
          </div>
        </motion.div>

        <Section icon={Shield} title="8. Changes to This Policy" delay={0.4}>
          <p>
            We may update this Privacy Policy periodically to reflect changes in law or our practices. Material changes will be communicated via in-app notification at least 15 days before they take effect. Continued use of Hospain after the effective date constitutes acceptance of the revised policy.
          </p>
          <p className="mt-3">
            For questions not covered here, contact us at <a href="mailto:privacy@hospain.in" className="text-primary hover:underline">privacy@hospain.in</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}
