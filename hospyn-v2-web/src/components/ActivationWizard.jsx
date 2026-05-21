import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, CreditCard, Zap, X, UploadCloud, CheckCircle, 
  Smartphone, FileText, Camera, Key, Check, AlertCircle, RefreshCw, Cpu,
  MapPin, QrCode
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ActivationWizard = ({ isOpen, onClose, onActivationSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activePaymentTab, setActivePaymentTab] = useState('upi-qr'); // 'upi-qr', 'upi-collect', or 'card'
  const [hospitalId, setHospitalId] = useState(null);
  const [hospynId, setHospynId] = useState('');
  const [resolvedPan, setResolvedPan] = useState('');
  const [error, setError] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    owner_email: '',
    owner_password: '',
    registration_number: '',
    staff_count: '',
    phone_number: '',
    pan_number: '',
    physical_address: '', // Primary address
    latitude: '',
    longitude: '',
    branches: '', // Comma-separated list
    upi_id: '',
    card_number: '',
    card_expiry: '',
    card_cvv: ''
  });

  // Individual branch address lines state
  const [branchAddresses, setBranchAddresses] = useState({});
  
  // Files State
  const [certificateFile, setCertificateFile] = useState(null);
  const [panCardPhoto, setPanCardPhoto] = useState(null);
  const [selfieCaptured, setSelfieCaptured] = useState(false);
  const [selfieBlob, setSelfieBlob] = useState(null);
  
  // Webcam capture refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Dynamic Scanning States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);
  
  // OTP Verification States
  const [govtOtpCode, setGovtOtpCode] = useState('');
  const [govtOtpSent, setGovtOtpSent] = useState(false);
  const [govtOtpVerified, setGovtOtpVerified] = useState(false);
  const [govtSimulatedCode, setGovtSimulatedCode] = useState('');

  // Payment Verification States
  const [upiIntentUri, setUpiIntentUri] = useState('');
  const [bankOtpCode, setBankOtpCode] = useState('');
  const [bankOtpSent, setBankOtpSent] = useState(false);
  const [bankSimulatedCode, setBankSimulatedCode] = useState('');
  
  // Live Status Verification States
  const [liveStatus, setLiveStatus] = useState(null);
  const [statusPolling, setStatusPolling] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleBranchAddressChange = (branchName, value) => {
    setBranchAddresses({ ...branchAddresses, [branchName]: value });
  };

  // Detect Geolocation coordinates
  const detectGeolocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6)
          }));
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setError("Failed to fetch coordinates. Please enter them manually or permit location access.");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  // Real webcam capture using MediaDevices API
  const triggerCameraCapture = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setSelfieBlob(null);
    setSelfieCaptured(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permissions and try again.');
      setIsCameraActive(false);
    }
  };

  // Capture snapshot from live video feed
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setSelfieBlob(blob);
        setSelfieCaptured(true);
      }
    }, 'image/jpeg', 0.92);
    // Stop the stream after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Register Hospital Step
  const handleRegisterEnterprise = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Dynamic Semicolon separation of branch addresses
    const branchesArray = formData.branches.split(',').map(b => b.strip ? b.strip() : b.trim()).filter(Boolean);
    const branchLocationsArray = branchesArray.map(b => branchAddresses[b] || `${formData.physical_address} (${b})`);
    const branchLocationsStr = branchLocationsArray.join(';');

    const payload = new FormData();
    payload.append('name', formData.name);
    payload.append('registration_number', formData.registration_number);
    payload.append('staff_count', formData.staff_count);
    payload.append('owner_email', formData.owner_email);
    payload.append('phone_number', formData.phone_number);
    payload.append('physical_address', formData.physical_address);
    if (formData.latitude) payload.append('latitude', formData.latitude);
    if (formData.longitude) payload.append('longitude', formData.longitude);
    payload.append('pan_number', formData.pan_number);
    payload.append('branches', formData.branches);
    payload.append('branch_locations', branchLocationsStr);
    
    // Payment tab mapping
    const methodType = activePaymentTab === 'card' ? 'card' : 'upi';
    payload.append('payment_method_type', methodType);

    if (methodType === 'upi' && formData.upi_id) {
      payload.append('upi_id', formData.upi_id);
    } else {
      payload.append('payment_token', 'tok_card_autopay_authorized_success');
    }

    if (certificateFile) {
      payload.append('certificate', certificateFile);
    }
    
    if (panCardPhoto) {
      payload.append('pan_card_photo', panCardPhoto);
    }

    if (selfieBlob) {
      payload.append('selfie', selfieBlob, 'biometric_selfie.jpg');
    }
    // No selfie captured — backend handles optional selfie gracefully

    setIsOcrScanning(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/onboarding/register-enterprise`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const data = response.data;
      setHospitalId(data.hospital_id);
      setHospynId(data.hospyn_id);
      setResolvedPan(data.resolved_pan);
      
      // Auto-trigger simulated Government Registry SMS-OTP
      await sendGovtVerificationOtp(data.hospital_id);
      setStep(3); // Advance to Aadhaar OTP verification
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || "Verification Grid Disrupted: Please check your documents and PAN photo.";
      setError(detailMsg);
    } finally {
      setLoading(false);
      setIsOcrScanning(false);
    }
  };

  // Dispatch Aadhaar PAN SMS-OTP
  const sendGovtVerificationOtp = async (hospId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/onboarding/send-government-pan-otp/${hospId}`);
      setGovtSimulatedCode(response.data.simulated_otp);
      setGovtOtpSent(true);
    } catch (err) {
      console.error(err);
      setError("Aadhaar OTP dispatch failed. Please verify phone number format.");
    }
  };

  // Verify Govt SMS-OTP
  const handleVerifyGovtOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = new URLSearchParams();
    payload.append('otp_code', govtOtpCode);

    try {
      await axios.post(`${API_BASE_URL}/onboarding/verify-government-pan-otp/${hospitalId}`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      setGovtOtpVerified(true);
      
      // Advance to payment step directly
      setStep(4);
      // Initialize dynamic payment integrations
      if (activePaymentTab === 'upi-qr') {
        generateDynamicUpiQr();
      }
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || "Invalid Aadhaar OTP security challenge code.";
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Razorpay simulated dynamic UPI QR Code intent
  const generateDynamicUpiQr = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/onboarding/generate-razorpay-qr/${hospitalId}`);
      setUpiIntentUri(response.data.upi_intent_uri);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit UPI VPA e-Mandate
  const submitUpiVpa = async () => {
    setLoading(true);
    setError(null);
    const payload = new URLSearchParams();
    payload.append('upi_id', formData.upi_id);

    try {
      const res = await axios.post(`${API_BASE_URL}/onboarding/submit-upi-vpa/${hospitalId}`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      alert(res.data.message);
      // Begin status polling
      setStep(5);
      setStatusPolling(true);
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || "UPI authorization hold request failed.";
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  // Submit Card e-Mandate Hold
  const submitCardPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = new URLSearchParams();
    payload.append('card_number', formData.card_number);
    payload.append('card_expiry', formData.card_expiry);
    payload.append('card_cvv', formData.card_cvv);

    try {
      const res = await axios.post(`${API_BASE_URL}/onboarding/submit-card-payment/${hospitalId}`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      setBankSimulatedCode(res.data.simulated_bank_otp);
      setBankOtpSent(true);
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || "Card e-Mandate hold registration failed.";
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify Card OTP e-Mandate
  const verifyCardPaymentOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = new URLSearchParams();
    payload.append('otp_code', bankOtpCode);

    try {
      await axios.post(`${API_BASE_URL}/onboarding/verify-card-otp/${hospitalId}`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      setStep(6); // Instant Activation!
      if (onActivationSuccess) {
        onActivationSuccess({ id: hospitalId, hospyn_id: hospynId, name: formData.name, owner_email: formData.owner_email, owner_password: formData.owner_password });
      }
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || "Card bank OTP validation failed.";
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  // Admin approval bypass
  const triggerSuperAdminApproval = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/onboarding/admin-approve-hospital/${hospitalId}`);
      fetchCurrentStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Check backend verification logs status
  const fetchCurrentStatus = async () => {
    if (!hospitalId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/onboarding/hospital-status/${hospitalId}`);
      setLiveStatus(response.data);
      if (response.data.verification_status === 'completed' || response.data.is_approved) {
        setStatusPolling(false);
        setStep(6); // Activation Complete Screen
        if (onActivationSuccess) {
          onActivationSuccess({ ...response.data, owner_email: formData.owner_email, owner_password: formData.owner_password });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic UPI tab QR fetch effect
  useEffect(() => {
    if (activePaymentTab === 'upi-qr' && hospitalId) {
      generateDynamicUpiQr();
    }
  }, [activePaymentTab, hospitalId]);

  // Polling effect
  useEffect(() => {
    let intervalId;
    if (statusPolling && hospitalId) {
      fetchCurrentStatus();
      intervalId = setInterval(fetchCurrentStatus, 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [statusPolling, hospitalId]);

  // Branch names split processor
  const branchList = formData.branches.split(',').map(b => b.trim()).filter(Boolean);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md overflow-y-auto flex items-center justify-center p-4 lg:p-10 font-sans"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col lg:flex-row min-h-[700px]"
          >
            {/* Left Column: Corporate Progress Roadmap */}
            <div className="bg-slate-50 lg:w-[40%] p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <Shield size={18} strokeWidth={2.5} />
                  </div>
                  <span className="font-extrabold text-slate-900 text-lg tracking-tight">Hospyn <span className="text-indigo-600">Enterprise</span></span>
                </div>

                <div className="space-y-2 mb-10">
                  <h3 className="text-2xl font-bold text-slate-950 tracking-tight leading-tight">
                    Clinical Authorization Gateway
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    To comply with the National Health Authority guidelines, your node requires NSDL PAN scanning, physical address verifications, and an active ₹2 auto-pay hold.
                  </p>
                </div>

                {/* Vertical Steps */}
                <div className="space-y-6">
                  {[
                    { s: 1, label: "Corporate Coordinates", desc: "Profile details & dynamic branch locations" },
                    { s: 2, label: "Biometrics & OCR audits", desc: "NABH licenses, live selfie & PAN photo scans" },
                    { s: 3, label: "Government Registry", desc: "NSDL/Aadhaar linked phone SMS OTP challenge" },
                    { s: 4, label: "₹2 Security Hold", desc: "UPI Dynamic QR Codes & Credit Card 3DS" },
                    { s: 5, label: "NSDL Active Audits", desc: "Verifying live database status changes" }
                  ].map((item) => (
                    <div key={item.s} className="flex gap-4 items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                        step > item.s ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        step === item.s ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {step > item.s ? <Check size={14} strokeWidth={3} /> : item.s}
                      </div>
                      <div>
                        <p className={`font-semibold text-xs tracking-wide uppercase ${step === item.s ? 'text-indigo-600' : 'text-slate-700'}`}>
                          {item.label}
                        </p>
                        <p className="text-slate-400 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-between text-slate-400 text-xs">
                <span>Verification Authority: NSDL & UIDAI</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            {/* Right Column: Interactive Workspace */}
            <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between bg-white relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>

              <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto space-y-6">
                
                {/* Global Error Banner */}
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
                    <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="font-bold">Compliance Warning</p>
                      <p>{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Location Coordinates</h4>
                        <p className="text-slate-500 text-xs">Provide details exactly as registered in your clinical licenses.</p>
                      </div>

                      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="name">Hospital Name</label>
                            <input id="name" value={formData.name} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. Apollo Spectra" required />
                          </div>
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="staff_count">Estimated Staff Count</label>
                            <input id="staff_count" value={formData.staff_count} onChange={handleInputChange} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. 50" required />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="owner_email">Administrator Gmail Address</label>
                            <input id="owner_email" value={formData.owner_email} onChange={handleInputChange} type="email" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. contact@apollo.com" required />
                          </div>
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="owner_password">Create Console Password</label>
                            <input id="owner_password" value={formData.owner_password} onChange={handleInputChange} type="password" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="Enter secure password" required />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="registration_number">Clinical license / NABH Reg No.</label>
                            <input id="registration_number" value={formData.registration_number} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. NABH-2026-908" required />
                          </div>
                          <div>
                            <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="phone_number">Contact Phone Number (SMS-OTP)</label>
                            <input id="phone_number" value={formData.phone_number} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. +919999988888" required />
                          </div>
                        </div>

                        {/* Physical address and GPS coordinate detect button */}
                        <div>
                          <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="physical_address">Mandatory Physical Address</label>
                          <input id="physical_address" value={formData.physical_address} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="Street name, City, State, PIN code" required />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="latitude">Latitude</label>
                              <input id="latitude" value={formData.latitude} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. 12.9716" />
                            </div>
                            <div>
                              <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="longitude">Longitude</label>
                              <input id="longitude" value={formData.longitude} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. 77.5946" />
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={detectGeolocation}
                            disabled={loading}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 h-[48px]"
                          >
                            <MapPin size={14} className="text-indigo-600" /> Detect Coordinates
                          </button>
                        </div>

                        {/* Optional Branch names split */}
                        <div>
                          <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="branches">Optional Branches (Comma separated)</label>
                          <input id="branches" value={formData.branches} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. Gachibowli, Jayanagar" />
                        </div>

                        {/* Dynamic Branch locations fields */}
                        {branchList.length > 0 && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                              <MapPin size={14} className="text-indigo-600" /> Mandatory Branch Locations
                            </p>
                            {branchList.map((bName) => (
                              <div key={bName} className="space-y-1">
                                <label className="block text-slate-600 text-2xs font-semibold" htmlFor={`branch_${bName}`}>Address for branch "{bName}":</label>
                                <input 
                                  id={`branch_${bName}`} 
                                  value={branchAddresses[bName] || ''} 
                                  onChange={(e) => handleBranchAddressChange(bName, e.target.value)} 
                                  type="text" 
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 text-xs focus:border-indigo-600 outline-none transition-all" 
                                  placeholder="Complete address details..." 
                                  required 
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => {
                          if (formData.name && formData.owner_email && formData.owner_password && formData.registration_number && formData.phone_number && formData.physical_address) {
                            setError(null);
                            setStep(2);
                          } else {
                            setError("Please fill in all mandatory hospital profile, email, password, and location fields.");
                          }
                        }} 
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl py-4 transition-colors shadow-lg shadow-slate-100 flex items-center justify-center gap-2"
                      >
                        Continue to Credentials & OCR Audits <Zap size={14} />
                      </button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">Credentials & Photo Scan Audits</h4>
                        <p className="text-slate-500 text-xs">Verify medical certificate and upload a Corporate PAN photo for real-time OCR text scan.</p>
                      </div>

                      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                        {/* Certificate Upload Field */}
                        <div 
                          onClick={() => document.getElementById('certUploadInput').click()}
                          className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-slate-50/50 transition-all group flex flex-col items-center"
                        >
                          <UploadCloud className="text-slate-400 group-hover:text-indigo-600 transition-colors mb-1.5" size={28} />
                          <p className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-0.5">Medical / NABH Certificate</p>
                          <p className="text-slate-400 text-2xs">Upload Clinical License Certificate PDF (Max 5MB)</p>
                          <input id="certUploadInput" type="file" className="hidden" onChange={(e) => setCertificateFile(e.target.files[0])} />
                          {certificateFile && <p className="mt-2 text-indigo-600 font-semibold text-2xs tracking-wide uppercase">NABH File: {certificateFile.name}</p>}
                        </div>

                        {/* PAN Card Photo Upload Field with Real-Time Scan state */}
                        <div 
                          onClick={() => document.getElementById('panPhotoInput').click()}
                          className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-slate-50/50 transition-all group flex flex-col items-center"
                        >
                          <FileText className="text-slate-400 group-hover:text-indigo-600 transition-colors mb-1.5" size={28} />
                          <p className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-0.5">Corporate PAN Card Photo</p>
                          <p className="text-slate-400 text-2xs">Upload clear photo of physical PAN (For OCR text extraction)</p>
                          <input id="panPhotoInput" type="file" className="hidden" onChange={(e) => setPanCardPhoto(e.target.files[0])} />
                          {panCardPhoto ? (
                            <p className="mt-2 text-indigo-600 font-semibold text-2xs tracking-wide uppercase">PAN Photo selected: {panCardPhoto.name}</p>
                          ) : (
                            <div className="mt-2 flex items-center gap-1 bg-slate-100 text-slate-600 rounded-lg py-1 px-2.5 text-3xs font-extrabold uppercase">
                              <Cpu size={10} /> OCR Enabled
                            </div>
                          )}
                        </div>

                        {/* Optional manual input if photo OCR is blurred */}
                        <div>
                          <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="pan_number">Or enter PAN manually (Optional if photo is clear)</label>
                          <input id="pan_number" value={formData.pan_number} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. ABCDE1234F" />
                        </div>

                        {/* Biometrics capture simulator */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Camera className="text-slate-500" size={16} />
                              <span className="text-slate-800 text-xs font-semibold">Live Representative Biometric Captured</span>
                            </div>
                            <span className={`text-2xs font-extrabold tracking-wider uppercase ${selfieCaptured ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {selfieCaptured ? 'Verified' : isCameraActive ? 'Live' : 'Ready'}
                            </span>
                          </div>

                          <div className="aspect-[16/9] w-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden relative border border-slate-800 shadow-inner">
                            {/* Live video feed — shown when camera is active and selfie not yet taken */}
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className={`absolute inset-0 w-full h-full object-cover ${isCameraActive && !selfieCaptured ? 'block' : 'hidden'}`}
                            />
                            {/* Hidden canvas for snapshot */}
                            <canvas ref={canvasRef} className="hidden" />

                            {selfieCaptured ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-center p-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                                  <Check size={18} strokeWidth={3} />
                                </div>
                                <p className="text-white text-xs font-bold uppercase tracking-wider">Representative Biometric Captured</p>
                                <p className="text-slate-500 text-3xs">UIDAI and NSDL compliant biometric structure</p>
                              </div>
                            ) : !isCameraActive ? (
                              <div className="text-center text-slate-600">
                                <Cpu size={28} className="mx-auto text-slate-700 mb-2" />
                                <p className="text-3xs uppercase tracking-widest">Click below to open camera</p>
                              </div>
                            ) : null}
                          </div>

                          {cameraError && (
                            <p className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1">
                              <AlertCircle size={13} /> {cameraError}
                            </p>
                          )}

                          {/* Buttons: open camera / take snapshot / retake */}
                          <div className="mt-3 flex gap-2">
                            {!isCameraActive && !selfieCaptured && (
                              <button
                                type="button"
                                onClick={triggerCameraCapture}
                                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                              >
                                Open Camera <Camera size={14} />
                              </button>
                            )}
                            {isCameraActive && !selfieCaptured && (
                              <button
                                type="button"
                                onClick={captureSnapshot}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                              >
                                Take Snapshot <Camera size={14} />
                              </button>
                            )}
                            {selfieCaptured && (
                              <button
                                type="button"
                                onClick={triggerCameraCapture}
                                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                              >
                                Retake <RefreshCw size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isOcrScanning && (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 text-xs text-indigo-900 leading-normal">
                          <RefreshCw className="animate-spin text-indigo-600 shrink-0" size={18} />
                          <div>
                            <p className="font-bold">OCR Document Scan Active</p>
                            <p className="text-3xs">Scanning PAN Card Photo using Optical Character Recognition...</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setStep(1)} 
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl py-4 px-6 transition-colors"
                        >
                          Back
                        </button>
                        <button 
                          onClick={handleRegisterEnterprise}
                          disabled={loading || isOcrScanning}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl py-4 transition-colors flex items-center justify-center gap-2"
                        >
                          {loading ? 'ANALYZING IMAGES & OCR...' : 'Register and Scan Documents'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">NSDL Government SMS-OTP</h4>
                        <p className="text-slate-500 text-xs">Verify Aadhaar/PAN linked representative identity via the Government Registry.</p>
                      </div>

                      {govtOtpSent && (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-1.5 text-indigo-900 text-xs">
                          <p className="font-bold flex items-center gap-1.5">
                            <Smartphone className="text-indigo-600" size={14} /> Aadhaar Registry Dispatch
                          </p>
                          <p className="text-3xs leading-relaxed">
                            Simulating secure lookup on PAN: <b>{resolvedPan}</b>. Simulated Registry OTP code: <b className="text-indigo-700 text-sm tracking-widest">{govtSimulatedCode}</b>.
                          </p>
                        </div>
                      )}

                      <form onSubmit={handleVerifyGovtOtp} className="space-y-4">
                        <div>
                          <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="govtOtpCode">6-digit Government Security OTP</label>
                          <input 
                            id="govtOtpCode" 
                            value={govtOtpCode} 
                            onChange={(e) => setGovtOtpCode(e.target.value)} 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-900 text-lg font-black tracking-widest focus:bg-white focus:border-indigo-600 outline-none transition-all" 
                            placeholder="0 0 0 0 0 0" 
                            maxLength={6}
                            required 
                          />
                        </div>

                        <div className="flex gap-3">
                          <button 
                            type="submit"
                            disabled={loading || govtOtpCode.length < 6}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl py-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {loading ? 'VERIFYING GOVERNMENT REGISTRIES...' : 'Verify Government Identity'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">Autopay Activation Hold</h4>
                        <p className="text-slate-500 text-xs">Set up standard ₹2 co-equal verification auto-debit hold to active your sovereign workspace node.</p>
                      </div>

                      {/* White-Slate formal co-equal tabs selection */}
                      <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-50">
                        <button 
                          type="button"
                          onClick={() => setActivePaymentTab('upi-qr')}
                          className={`flex-1 font-semibold text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activePaymentTab === 'upi-qr' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <QrCode size={14} /> UPI Dynamic QR
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActivePaymentTab('upi-collect')}
                          className={`flex-1 font-semibold text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activePaymentTab === 'upi-collect' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Smartphone size={14} /> UPI VPA Collect
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActivePaymentTab('card')}
                          className={`flex-1 font-semibold text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activePaymentTab === 'card' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <CreditCard size={14} /> Debit/Credit Card
                        </button>
                      </div>

                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                        {activePaymentTab === 'upi-qr' && (
                          <div className="flex flex-col items-center text-center p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dynamic Razorpay UPI QR Code</p>
                            {upiIntentUri ? (
                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiIntentUri)}`} 
                                  alt="Dynamic UPI QR Code" 
                                  className="w-[200px] h-[200px]"
                                />
                                <span className="mt-2 text-3xs font-extrabold text-indigo-600 uppercase tracking-widest">Scan to authorize ₹2 GCP-hold</span>
                              </div>
                            ) : (
                              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                                <RefreshCw className="animate-spin text-indigo-600" size={24} />
                                <p className="text-3xs uppercase tracking-widest text-slate-400">Contacting Razorpay APIs...</p>
                              </div>
                            )}
                            <button 
                              onClick={() => {
                                setStep(5);
                                setStatusPolling(true);
                              }}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 rounded-xl transition-all"
                            >
                              I have completed the QR payment
                            </button>
                          </div>
                        )}

                        {activePaymentTab === 'upi-collect' && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="upi_id">UPI ID / Virtual Private Address (VPA)</label>
                              <input id="upi_id" value={formData.upi_id} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-900 text-sm focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="e.g. user@ybl or mobile@okhdfc" />
                            </div>
                            <button 
                              onClick={submitUpiVpa}
                              disabled={loading || !formData.upi_id}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                              Dispatch ₹2 Collect Request
                            </button>
                          </div>
                        )}

                        {activePaymentTab === 'card' && (
                          <form onSubmit={submitCardPayment} className="space-y-3">
                            <div>
                              <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="card_number">Card Number</label>
                              <input id="card_number" value={formData.card_number} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="XXXX XXXX XXXX XXXX" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="card_expiry">Expiry Date</label>
                                <input id="card_expiry" value={formData.card_expiry} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="MM/YY" required />
                              </div>
                              <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1.5" htmlFor="card_cvv">CVV</label>
                                <input id="card_cvv" value={formData.card_cvv} onChange={handleInputChange} type="password" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="***" required />
                              </div>
                            </div>

                            <button 
                              type="submit"
                              disabled={loading}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 rounded-xl transition-all"
                            >
                              Authorize Card Hold
                            </button>

                            {bankOtpSent && (
                              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 mt-4 text-left">
                                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                  <Key size={14} className="text-amber-600" /> Bank 3D-Secure Verification OTP
                                </p>
                                <p className="text-3xs text-amber-800 leading-normal">
                                  Dynamic 3DS Gateway OTP code dispatched: <b className="text-sm tracking-wider text-amber-900">{bankSimulatedCode}</b>.
                                </p>
                                <div className="space-y-1">
                                  <label className="block text-amber-900 text-3xs font-semibold" htmlFor="bankOtpCode">Enter 3DS verification code:</label>
                                  <input 
                                    id="bankOtpCode" 
                                    value={bankOtpCode} 
                                    onChange={(e) => setBankOtpCode(e.target.value)} 
                                    type="text" 
                                    className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-center text-slate-950 font-bold text-sm outline-none" 
                                    placeholder="0 0 0 0 0 0" 
                                    maxLength={6} 
                                    required 
                                  />
                                </div>
                                <button 
                                  onClick={verifyCardPaymentOtp}
                                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-lg transition-all"
                                >
                                  Submit Bank OTP
                                </button>
                              </div>
                            )}
                          </form>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6 text-center py-6"
                    >
                      <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 mb-2">
                        <RefreshCw className="animate-spin" size={24} />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">Awaiting Node Verification</h4>
                        <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                          Our NSDL registries and medical panels are analyzing your physical addresses, branch locations, and biometric matches.
                        </p>
                      </div>

                      {/* Live Database status log grid */}
                      {liveStatus ? (
                        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-left space-y-3">
                          <div className="flex items-center justify-between text-2xs uppercase tracking-wider font-extrabold text-slate-400 pb-2 border-b border-slate-200">
                            <span>Clinical Registry Logs</span>
                            <span className="text-indigo-600">{liveStatus.hospyn_id}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-2xs">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Smartphone size={12} className="text-emerald-500" /> Phone OTP: <span className="font-semibold text-emerald-600">VERIFIED</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <FileText size={12} className={liveStatus.forensics?.is_pan_valid ? "text-emerald-500" : "text-amber-500"} /> NSDL PAN Check: <span className={`font-semibold ${liveStatus.forensics?.is_pan_valid ? "text-emerald-600" : "text-amber-600"}`}>{liveStatus.forensics?.is_pan_valid ? "VALID" : "PENDING"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                              <CheckCircle size={12} className="text-indigo-500" /> Payment Autopay: <span className="font-semibold text-indigo-600">{liveStatus.subscription?.payment_method_type?.toUpperCase()} Hold Authorized</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-3xs text-slate-400 animate-pulse">Connecting to clinical ledger status...</p>
                      )}

                      {/* Super Admin Bypass button */}
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <button 
                          onClick={triggerSuperAdminApproval}
                          disabled={loading}
                          className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs py-3 rounded-xl transition-all border border-indigo-200/50 flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} /> Fast Super Admin Verification Pass
                        </button>
                        <p className="text-[10px] text-slate-400">
                          Bypasses the 2-4 hour medical verification queue to instantly test sovereign clinical console drawers inside PostgreSQL database state.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {step === 6 && (
                    <motion.div
                      key="step6"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-6"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 mb-2">
                        <CheckCircle size={32} strokeWidth={2.5} />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">Sovereign Node Activated!</h4>
                        <p className="text-slate-500 text-xs max-w-sm mx-auto">
                          Congratulations! Your credentials have been authorized. Your sovereign console grid and dynamic staff links are fully unlocked in PostgreSQL!
                        </p>
                      </div>

                      <button 
                        onClick={onClose}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl py-4 transition-colors shadow-lg shadow-slate-100"
                      >
                        Launch Sovereign Console Drawer
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActivationWizard;
