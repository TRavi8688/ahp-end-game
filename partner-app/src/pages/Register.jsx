import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, Lock, Check, CreditCard, FileText, Upload, AlertCircle, ChevronLeft } from 'lucide-react';
import apiClient from '../services/apiClient';
import Logo from '../components/Logo';

const STEP_LABELS = ['Account Details', 'PAN Details', 'License Upload'];

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEP_LABELS.map((label, idx) => {
        const num = idx + 1;
        const done = num < step;
        const active = num === step;
        return (
          <React.Fragment key={label}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                done ? 'bg-success-500 text-white' : active ? 'bg-primary-600 text-white' : 'bg-lavender-100 text-gray-400'
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : num}
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`w-10 h-0.5 ${done ? 'bg-success-500' : 'bg-lavender-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Account Details
  const [fullName, setFullName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Step 2 — PAN Details
  const [panNumber, setPanNumber] = useState('');
  const [panName, setPanName] = useState('');
  const [panPhoto, setPanPhoto] = useState(null);

  // Step 3 — License
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [licenseFile, setLicenseFile] = useState(null);

  const passwordChecks = {
    length: password.length >= 8,
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const handleNextFromStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!fullName || !pharmacyName || !registrationNumber || !email || !phone || !password || !address) {
      setError('Please fill in every field before continuing.');
      return;
    }
    if (!Object.values(passwordChecks).every(Boolean)) {
      setError('Password must meet all the requirements below.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setStep(2);
  };

  const handleNextFromStep2 = (e) => {
    e.preventDefault();
    setError('');
    if (!panNumber || !panName) {
      setError('PAN number and government name are required.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!licenseNumber || !licenseDate) {
      setError('License number and date of issue are required.');
      return;
    }
    setSubmitting(true);
    try {
      // EXECUTION: wires to the now-fixed POST /onboarding/register-enterprise.
      // This call also creates the owner's login account server-side
      // (inactive until approved) — see backend/healthcare-core/app/api/v1/onboarding.py
      const form = new FormData();
      form.append('name', pharmacyName);
      form.append('registration_number', registrationNumber);
      form.append('owner_email', email);
      form.append('owner_password', password);
      form.append('phone_number', phone);
      form.append('physical_address', address);
      form.append('pan_number', panNumber);
      if (panPhoto) form.append('pan_card_photo', panPhoto);
      if (licenseFile) form.append('certificate', licenseFile);

      const res = await apiClient.post('/onboarding/register-enterprise', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate('/verification-pending', { state: { hospitalId: res.data.hospital_id } });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Registration failed. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full pl-11 pr-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm';

  return (
    <div className="min-h-screen bg-lavender-50 flex flex-col items-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 mt-4">
          <Logo variant="full" className="w-40 mb-1" />
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-card border border-lavender-100">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-3 -ml-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          <p className="text-xs font-bold text-primary-600 uppercase tracking-wide text-center mb-2">
            Step {step} of 3: {STEP_LABELS[step - 1]}
          </p>
          <Stepper step={step} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNextFromStep1} className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="John Doe" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Pharmacy Name</label>
                <input value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} className="w-full px-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm" placeholder="Apollo Pharmacy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Registration Number</label>
                <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="w-full px-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm" placeholder="DL-12345" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="johndoe@example.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Pharmacy Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm" placeholder="Street, City, State, PIN" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                </div>
                <div className="mt-2 space-y-1">
                  {[
                    ['At least 8 characters', passwordChecks.length],
                    ['Contains a number', passwordChecks.number],
                    ['Contains a special character', passwordChecks.special],
                  ].map(([label, ok]) => (
                    <div key={label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-success-600' : 'text-gray-400'}`}>
                      <Check className="w-3.5 h-3.5" /> {label}
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-600 pt-1">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-primary-600" />
                I agree to the <span className="text-primary-600 font-medium">Terms of Service</span> and <span className="text-primary-600 font-medium">Privacy Policy</span>
              </label>
              <button type="submit" className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3.5 rounded-full transition-all shadow-floating mt-2">
                Next
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNextFromStep2} className="space-y-4">
              <h3 className="text-lg font-bold text-ink-900">Verify Your PAN Details</h3>
              <p className="text-sm text-gray-500 -mt-2">Please provide your PAN card details to complete your profile verification.</p>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">PAN Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    maxLength={10}
                    className={inputClass}
                    placeholder="ABCDE1234F"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Government Name (As per PAN)</label>
                <input value={panName} onChange={(e) => setPanName(e.target.value)} className="w-full px-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm" placeholder="Enter full name (e.g., Jane Doe)" />
              </div>

              <div className="bg-lavender-50 rounded-2xl p-4 border border-lavender-100">
                <p className="text-sm font-semibold text-ink-900 mb-2">PAN Card Upload</p>
                <label className="border-2 border-dashed border-primary-200 rounded-xl flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-white transition-colors">
                  <Upload className="w-6 h-6 text-primary-400 mb-2" />
                  <span className="text-sm font-semibold text-ink-900">{panPhoto ? panPhoto.name : 'Tap to Upload'}</span>
                  <span className="text-xs text-gray-400 mt-1">JPG, PNG, PDF (Max 5MB)</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setPanPhoto(e.target.files?.[0] || null)} />
                </label>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3.5 rounded-full transition-all shadow-floating mt-2">
                Continue
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-lg font-bold text-ink-900">Verify Clinical Certificate</h3>
              <p className="text-sm text-gray-500 -mt-2">Upload your valid Government Medical License for verification.</p>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Medical License Number</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputClass} placeholder="Enter License Number" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-900 mb-1.5">Date of Issue</label>
                <input type="date" value={licenseDate} onChange={(e) => setLicenseDate(e.target.value)} className="w-full px-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm" />
              </div>

              <label className="border-2 border-dashed border-primary-200 rounded-2xl flex flex-col items-center justify-center py-8 cursor-pointer hover:bg-lavender-50 transition-colors">
                <Upload className="w-7 h-7 text-primary-500 mb-2" />
                <span className="text-sm font-semibold text-ink-900">{licenseFile ? licenseFile.name : 'Drag & Drop File Here'}</span>
                {!licenseFile && <span className="text-xs text-primary-600 font-semibold mt-2 bg-lavender-50 px-3 py-1.5 rounded-lg">Browse Files</span>}
                <span className="text-xs text-gray-400 mt-2">Allowed formats: PDF, JPG, PNG (Max size: 10MB)</span>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
              </label>
              <p className="text-xs text-gray-400 text-center">Please ensure your government license is valid and clearly legible.</p>

              <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3.5 rounded-full transition-all shadow-floating disabled:opacity-70">
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account? <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
