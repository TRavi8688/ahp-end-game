import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Users, CreditCard, AlertTriangle, Scale, ChevronRight, Clock, Stethoscope } from 'lucide-react';

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

const Clause = ({ number, title, children }) => (
  <div className="rounded-lg bg-white/3 border border-white/5 px-4 py-4 mb-3">
    <p className="text-white font-bold text-sm mb-1">
      <span className="text-primary mr-2">{number}.</span>{title}
    </p>
    <p className="text-slate-400 text-xs leading-relaxed">{children}</p>
  </div>
);

export default function TermsOfService() {
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
          <ChevronRight size={12} className="rotate-180" /> Back to Hospyn
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
            <FileText size={10} /> Governing Law: Republic of India
          </div>
          <h1 className="text-5xl md:text-6xl font-black outfit leading-tight tracking-tighter mb-6 premium-gradient-text">
            Terms of Service
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            These Terms of Service govern your use of the Hospyn platform and services operated by <strong className="text-slate-300">Hospyn Technologies Pvt Ltd</strong>. By accessing or using Hospyn, you agree to these terms.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-slate-600">
            <Clock size={12} />
            <span>Last updated: June 2026 &nbsp;·&nbsp; Effective: June 1, 2026</span>
          </div>
        </motion.div>

        {/* Medical Disclaimer — prominent */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-card p-6 mb-8 border border-amber-500/30 bg-amber-500/5"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Stethoscope className="text-amber-400" size={18} />
            </div>
            <div>
              <p className="text-amber-400 font-black text-sm uppercase tracking-widest mb-2">Medical Disclaimer</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Hospyn is a <strong>healthcare management and connectivity platform</strong> — not a medical service provider. AI health assistance features are <strong>informational only</strong> and do not constitute professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional for medical decisions. In an emergency, contact your local emergency services immediately.
              </p>
            </div>
          </div>
        </motion.div>

        <Section icon={Users} title="1. Platform Users & Eligibility" delay={0.1}>
          <p>The Hospyn platform serves three distinct user categories, each subject to these terms:</p>
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            {[
              { title: 'Patients', desc: 'Individuals seeking to book appointments, access health records, and use AI health assistance.' },
              { title: 'Doctors', desc: 'Registered medical practitioners using Hospyn to manage patient appointments and records.' },
              { title: 'Hospital Owners / Admins', desc: 'Organisations or individuals who have registered their facility on the Hospyn platform.' },
            ].map((u, i) => (
              <div key={i} className="rounded-xl bg-white/3 border border-white/5 p-4">
                <p className="text-white font-bold text-sm mb-2">{u.title}</p>
                <p className="text-slate-400 text-xs">{u.desc}</p>
              </div>
            ))}
          </div>
          <Clause number="1.1" title="Age Requirement">
            You must be at least 18 years old to create an account. Minors may use the platform only through a parent or legal guardian's account.
          </Clause>
          <Clause number="1.2" title="Account Accuracy">
            You are responsible for providing accurate registration information and keeping it up to date. False information, including impersonation of healthcare professionals, may result in immediate termination.
          </Clause>
          <Clause number="1.3" title="Healthcare Provider Verification">
            Doctors and hospital administrators must complete identity and credential verification as required by Hospyn before accessing provider-level features. Hospyn reserves the right to reject or revoke access at its discretion.
          </Clause>
        </Section>

        <Section icon={FileText} title="2. Platform Usage Terms" delay={0.15}>
          <Clause number="2.1" title="Permitted Use">
            Hospyn may only be used for lawful purposes in connection with healthcare management, appointment booking, health record storage, and related activities expressly supported by the platform.
          </Clause>
          <Clause number="2.2" title="Prohibited Conduct">
            You may not: (a) upload false, misleading, or fraudulent medical information; (b) attempt to access another user's account or data without authorisation; (c) use the platform to distribute spam, malware, or unsolicited commercial communications; (d) reverse-engineer, scrape, or extract platform data; (e) use AI features to diagnose, prescribe, or provide medical advice to others.
          </Clause>
          <Clause number="2.3" title="AI Health Assistant">
            AI-generated responses are for general informational purposes only. They are not a substitute for professional medical advice. Hospyn expressly disclaims liability for any decisions made based solely on AI-generated content.
          </Clause>
          <Clause number="2.4" title="Appointment Commitments">
            Patients who book appointments through Hospyn are expected to attend or cancel at least 2 hours in advance. Repeated no-shows may result in account restrictions. Doctors and hospitals are expected to honour confirmed bookings.
          </Clause>
        </Section>

        <Section icon={CreditCard} title="3. Payment Terms" delay={0.2}>
          <Clause number="3.1" title="Payment Processing">
            All payments on Hospyn are processed through RBI-compliant payment gateways. Hospyn does not store raw card numbers or UPI credentials.
          </Clause>
          <Clause number="3.2" title="Subscription & Fees">
            Hospital and doctor accounts operating on a subscription model will be charged as per the plan selected at registration. Pricing is displayed in Indian Rupees (INR) inclusive of applicable GST.
          </Clause>
          <Clause number="3.3" title="Refund Policy">
            Appointment consultation fees: refund requests must be raised within 7 days of the appointment date. Refunds are processed within 5–7 business days to the original payment method. Platform subscription fees are non-refundable except as required by applicable law.
          </Clause>
          <Clause number="3.4" title="Failed Payments">
            In the event of a failed subscription payment, Hospyn will notify you and allow a 7-day grace period before restricting provider-level features.
          </Clause>
        </Section>

        <Section icon={AlertTriangle} title="4. Account Suspension & Termination" delay={0.25}>
          <Clause number="4.1" title="By You">
            You may delete your account at any time from the account settings. Upon deletion, your personal data will be retained only as required by applicable retention laws (see Privacy Policy Section 3).
          </Clause>
          <Clause number="4.2" title="By Hospyn">
            Hospyn may suspend or terminate your account immediately and without notice if: (a) you violate these Terms; (b) you engage in fraudulent or illegal activity; (c) your continued use poses a risk to other users or the platform; (d) required by law or regulatory order.
          </Clause>
          <Clause number="4.3" title="Effect of Termination">
            Upon termination, your right to use the platform ceases immediately. Data export requests must be submitted before account deletion. Hospyn will honour such requests within 30 days subject to identity verification.
          </Clause>
          <Clause number="4.4" title="Appeals">
            If you believe your account was suspended in error, you may appeal by writing to <a href="mailto:support@hospyn.in" className="text-primary hover:underline">support@hospyn.in</a> within 15 days of suspension.
          </Clause>
        </Section>

        <Section icon={FileText} title="5. Intellectual Property" delay={0.3}>
          <p>
            All content, code, AI models, trademarks, and designs on the Hospyn platform are the exclusive property of Hospyn Technologies Pvt Ltd or its licensors. Nothing in these Terms grants you a right to use our brand, logo, or proprietary technology outside the platform.
          </p>
          <p>
            Health records and personal data you upload remain your property. By uploading, you grant Hospyn a limited, non-exclusive licence to process that data solely for the purposes described in the Privacy Policy.
          </p>
        </Section>

        <Section icon={AlertTriangle} title="6. Limitation of Liability" delay={0.35}>
          <p>
            To the maximum extent permitted by applicable Indian law, Hospyn Technologies Pvt Ltd shall not be liable for: (a) indirect, incidental, or consequential damages arising from use of the platform; (b) medical outcomes resulting from decisions made on the basis of AI-generated content; (c) service interruptions due to force majeure events including natural disasters, government orders, or infrastructure failures.
          </p>
          <p className="mt-3">
            Our aggregate liability for any claim arising out of or related to these Terms shall not exceed the total fees paid by you to Hospyn in the 3 months preceding the claim.
          </p>
        </Section>

        {/* Governing Law Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="glass-card p-8 mb-6 border-primary/20"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Scale className="text-primary" size={18} />
            </div>
            <h2 className="text-xl font-black outfit text-white tracking-tight">7. Governing Law & Dispute Resolution</h2>
          </div>
          <div className="pl-14 space-y-4 text-slate-400 text-sm">
            <p>
              These Terms are governed by and construed in accordance with the laws of the <strong className="text-slate-300">Republic of India</strong>, including but not limited to the Information Technology Act 2000, the Digital Personal Data Protection Act 2023, and the Consumer Protection Act 2019.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/3 border border-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Jurisdiction</p>
                <p className="text-white font-bold">Hyderabad, Telangana</p>
                <p className="text-slate-400 text-xs mt-1">All disputes subject to exclusive jurisdiction of courts in Hyderabad, Telangana, India.</p>
              </div>
              <div className="rounded-xl bg-white/3 border border-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Arbitration</p>
                <p className="text-white font-bold">Arbitration & Conciliation Act, 1996</p>
                <p className="text-slate-400 text-xs mt-1">Disputes may be referred to binding arbitration before litigation, conducted in English in Hyderabad.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <Section icon={FileText} title="8. Modifications to Terms" delay={0.45}>
          <p>
            Hospyn reserves the right to modify these Terms at any time. Material changes will be communicated via in-app notification at least 15 days before they take effect. Your continued use of the platform after the effective date constitutes acceptance of the revised Terms.
          </p>
          <p className="mt-3">
            For questions about these Terms, contact us at <a href="mailto:legal@hospyn.in" className="text-primary hover:underline">legal@hospyn.in</a> &nbsp;·&nbsp; Hospyn Technologies Pvt Ltd, Hyderabad, Telangana — 500001.
          </p>
        </Section>
      </div>
    </div>
  );
}
