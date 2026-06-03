import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Users, Clock, Calendar, Activity, 
  UserPlus, ShieldAlert, CreditCard, CheckCircle2,
  Printer, X, ChevronRight, Check, Sparkles, RefreshCw
} from 'lucide-react';
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

interface WalkInRequest {
  id: string;
  queue_number: number;
  full_name: string;
  phone: string;
  age: number;
  gender: string;
  reason_for_visit: string;
  symptoms?: string;
  priority_level: string;
  queue_state: string;
  wait_minutes: number;
  billing_status: string;
  billing_amount: number;
}

interface DoctorRosterItem {
  id: string;
  full_name: string;
  specialization: string;
  consultation_fee: number;
  years_of_experience: number;
  active_load: number;
  avatar_url?: string;
}

interface SearchPatientResult {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  known_allergies?: string;
  chronic_conditions?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

const ReceptionDashboard: React.FC = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<WalkInRequest[]>([]);
  const [stats, setStats] = useState({ total_pending: 0, state_counts: {} as any });
  const [doctors, setDoctors] = useState<DoctorRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchPatientResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Manual Form State (Drawer)
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    hospyn_id: '', first_name: '', last_name: '', phone: '', age: '', gender: 'Male', reason_for_visit: '', priority_level: 'normal', symptoms: ''
  });

  // Billing Drawer State
  const [selectedWalkinForBilling, setSelectedWalkinForBilling] = useState<WalkInRequest | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Receipt Modal State
  const [receiptToPrint, setReceiptToPrint] = useState<WalkInRequest | null>(null);

  // Route to Doctor Picker State
  const [routingWalkin, setRoutingWalkin] = useState<WalkInRequest | null>(null);

  // QR Token State
  const [hospitalQrToken, setHospitalQrToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/reception/queue');
      setQueue(res.data.data.queue);
      setStats({
        total_pending: res.data.data.total_pending,
        state_counts: res.data.data.state_counts
      });
    } catch (err) {
      console.error('Failed to fetch queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await apiClient.get('/reception/doctors');
      setDoctors(res.data.data);
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };

  const fetchQrToken = async () => {
    try {
      const res = await apiClient.get('/reception/qr-token');
      setHospitalQrToken(res.data.data.token);
    } catch (err) {
      console.error('Failed to fetch QR token', err);
    }
  };

  // Real-time connection manager
  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8002/api/v1/healthcare'}/ws/reception?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS Connection Established');
      setIsWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('WS event received:', payload);
        // Refresh queue and roster on any updates
        if (payload.event !== 'pong') {
          fetchQueue();
          fetchDoctors();
        }
      } catch (err) {
        console.error('Error handling WS frame', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Error', err);
      setIsWsConnected(false);
    };

    ws.onclose = () => {
      console.log('WS Disconnected, retrying in 5 seconds...');
      setIsWsConnected(false);
      setTimeout(connectWebSocket, 5000);
    };
  };

  useEffect(() => {
    fetchQueue();
    fetchDoctors();
    fetchQrToken();
    connectWebSocket();

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Quick Patient Search Lookup
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const res = await apiClient.get(`/reception/patients/search?q=${searchQuery}`);
          setSearchResults(res.data.data);
          setShowSearchResults(true);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const selectPatientFromSearch = (patient: SearchPatientResult) => {
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      age: patient.age ? String(patient.age) : '',
      gender: patient.gender || 'Male',
      reason_for_visit: '',
      priority_level: 'normal',
      symptoms: patient.known_allergies ? `Known Allergies: ${patient.known_allergies}` : ''
    });
    setShowSearchResults(false);
    setSearchQuery('');
    setShowManualForm(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/reception/queue/manual', {
        ...formData,
        age: parseInt(formData.age, 10)
      });
      setShowManualForm(false);
      setFormData({
        hospyn_id: '', first_name: '', last_name: '', phone: '', age: '', gender: 'Male', reason_for_visit: '', priority_level: 'normal', symptoms: ''
      });
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to check in patient manually.');
    }
  };

  const handleRouteWalkin = async (route_to: 'triage' | 'doctor', doc_id?: string) => {
    if (!routingWalkin) return;
    try {
      await apiClient.patch(`/reception/queue/${routingWalkin.id}/accept`, {
        route_to,
        assigned_doctor_id: doc_id
      });
      setRoutingWalkin(null);
      fetchQueue();
      fetchDoctors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to route patient.');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this walk-in request?')) return;
    try {
      await apiClient.patch(`/reception/queue/${id}/reject`, { reason: 'Cancelled by receptionist' });
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalkinForBilling) return;
    setIsProcessingPayment(true);
    try {
      await apiClient.patch(`/reception/queue/${selectedWalkinForBilling.id}/pay`, {
        payment_method: paymentMethod,
        transaction_reference: transactionRef || null
      });
      
      const updatedWalkin = {
        ...selectedWalkinForBilling,
        billing_status: 'paid',
        payment_method: paymentMethod,
        payment_reference: transactionRef
      };
      
      setSelectedWalkinForBilling(null);
      setTransactionRef('');
      setReceiptToPrint(updatedWalkin);
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to collect payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const printReceipt = () => {
    const printContent = document.getElementById('receipt-print-area');
    if (!printContent) return;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime().toString();
    const printWindow = window.open(windowUrl, uniqueName, 'left=50000,top=50000,width=0,height=0');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Clinic Receipt</title>
            <style>
              body { font-family: monospace; font-size: 12px; line-height: 1.4; padding: 20px; max-width: 300px; color: #000; }
              .header { text-align: center; font-weight: bold; margin-bottom: 15px; }
              .divider { border-top: 1px dashed #000; margin: 10px 0; }
              .row { display: flex; justify-content: space-between; margin: 4px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-10 bg-[#050505] text-[#f8fafc] font-inter overflow-x-hidden">
      
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className={`w-2.5 h-2.5 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
             <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${isWsConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
               {isWsConnected ? 'Live Connection Sync' : 'Offline Mode (Polling)'}
             </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter outfit leading-none text-white">Reception Command Hub</h1>
          <p className="text-slate-500 text-sm font-medium">Operations Center &bull; {(user as any)?.name || user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <button 
            onClick={() => setShowQrModal(true)} 
            className="flex-1 md:flex-none border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all flex items-center justify-center gap-2"
          >
             <Sparkles size={16} className="text-amber-500" /> Hospital QR Code
          </button>
          <button 
            onClick={() => {
              setFormData({
                hospyn_id: '', first_name: '', last_name: '', phone: '', age: '', gender: 'Male', reason_for_visit: '', priority_level: 'normal', symptoms: ''
              });
              setShowManualForm(true);
            }} 
            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
          >
             <UserPlus size={18} /> Manual Intake
          </button>
        </div>
      </header>

      {/* Stats HUD Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
        {[
          { label: 'Waiting Queue', value: stats.total_pending, unit: 'PTs', icon: Users, color: 'text-amber-500', bg: 'from-amber-500/10 to-transparent border-amber-500/10' },
          { label: 'Triage Intake', value: stats.state_counts['in_triage'] || 0, unit: 'PTs', icon: Activity, color: 'text-blue-500', bg: 'from-blue-500/10 to-transparent border-blue-500/10' },
          { label: 'Consultations', value: stats.state_counts['in_consultation'] || 0, unit: 'PTs', icon: Clock, color: 'text-indigo-500', bg: 'from-indigo-500/10 to-transparent border-indigo-500/10' },
          { label: 'Completed Today', value: stats.state_counts['completed'] || 0, unit: 'PTs', icon: Calendar, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-transparent border-emerald-500/10' },
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.bg} bg-white/[0.02] border border-white/5 rounded-[24px] md:rounded-[32px] p-6 md:p-8 relative overflow-hidden transition-all hover:scale-[1.01]`}>
             <div className="absolute top-0 right-0 p-4 md:p-6 opacity-[0.03]"><stat.icon size={80} /></div>
             <div className={`p-2.5 rounded-xl bg-white/5 ${stat.color} w-fit mb-4 md:mb-6`}><stat.icon size={20} /></div>
             <h2 className="text-3xl md:text-4xl font-black outfit tracking-tighter">{stat.value}<span className="text-xs font-semibold text-slate-500 ml-1">{stat.unit}</span></h2>
             <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Hand Board / Main Active Queue */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          
          {/* Quick Express Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="text-slate-500" size={18} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name or phone for express check-in..."
              className="w-full bg-white/[0.03] border border-white/5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-[20px] pl-14 pr-6 py-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                <RefreshCw size={16} className="text-slate-500 animate-spin" />
              </div>
            )}
            
            {/* Search Dropdown Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5">
                {searchResults.map((patient) => (
                  <div 
                    key={patient.id} 
                    onClick={() => selectPatientFromSearch(patient)}
                    className="p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{patient.full_name}</h4>
                      <p className="text-xs text-slate-500">{patient.phone} &bull; {patient.gender || 'Unknown'} &bull; {patient.age ? `${patient.age} Yrs` : 'N/A Date of birth'}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Walk-ins List Card */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] md:rounded-[40px] overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/5 flex flex-wrap justify-between items-center bg-white/[0.01] gap-4">
               <div className="flex items-center gap-3">
                  <Users className="text-indigo-500" size={22} />
                  <h3 className="text-lg md:text-xl font-black outfit tracking-tight">Walk-In Waiting Board</h3>
               </div>
               <span className="px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                  {queue.length} Receptionist Action Pending
               </span>
            </div>

            <div className="divide-y divide-white/5">
               {isLoading && <div className="p-16 text-center text-slate-500">Loading live queue...</div>}
               {!isLoading && queue.length === 0 && (
                 <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                   All patients routed successfully. No active walk-ins.
                 </div>
               )}
               
               {queue.map((p) => (
                  <div key={p.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.01] transition-all">
                     <div className="flex items-start md:items-center gap-4 md:gap-6">
                        <div className={`w-14 h-14 rounded-[20px] flex-shrink-0 flex items-center justify-center font-black text-xl outfit border ${
                           p.priority_level === 'emergency' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 
                           p.priority_level === 'urgent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                           'bg-white/5 text-slate-400 border-white/10'
                        }`}>
                           {p.queue_number}
                        </div>
                        
                        <div className="space-y-1">
                           <div className="flex flex-wrap items-center gap-2 md:gap-3">
                              <h4 className="text-lg md:text-xl font-bold outfit tracking-tight text-white">{p.full_name}</h4>
                              {p.priority_level === 'emergency' && (
                                <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded font-black uppercase tracking-widest">
                                  <ShieldAlert size={10} /> Emergency
                                </span>
                              )}
                              
                              {/* Payment Status Badges */}
                              {p.billing_status === 'paid' ? (
                                <span 
                                  onClick={() => setReceiptToPrint(p)}
                                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-500/30 transition-all"
                                >
                                  <Check size={10} /> Paid <Printer size={10} className="ml-1" />
                                </span>
                              ) : (
                                <span 
                                  onClick={() => setSelectedWalkinForBilling(p)}
                                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-black uppercase tracking-widest cursor-pointer hover:bg-amber-500/30 transition-all"
                                >
                                  <CreditCard size={10} /> Unpaid (Pay Now)
                                </span>
                              )}
                           </div>
                           <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <span>{p.phone}</span>
                              <div className="w-1 h-1 rounded-full bg-slate-800" />
                              <span>{p.gender} &bull; {p.age} Yrs</span>
                              <div className="w-1 h-1 rounded-full bg-slate-800" />
                              <span>Waiting: <span className={p.wait_minutes > 30 ? 'text-rose-500' : 'text-indigo-400'}>{p.wait_minutes} Mins</span></span>
                           </div>
                        </div>
                     </div>

                     <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                       <button 
                         onClick={() => setRoutingWalkin(p)} 
                         className="flex-1 md:flex-none bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-6 py-3 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all"
                       >
                          Route / Assign
                       </button>
                       <button 
                         onClick={() => handleReject(p.id)} 
                         className="p-3 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all border border-white/5"
                       >
                          <X size={16} />
                       </button>
                     </div>
                  </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right Hand Board / Doctor Load Roster */}
        <div className="col-span-12 xl:col-span-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] md:rounded-[40px] p-6 md:p-8">
             <div className="flex items-center gap-3 mb-6">
                <Activity className="text-indigo-500" size={20} />
                <h3 className="text-lg font-black outfit uppercase tracking-tight text-white">Live Doctor Roster</h3>
             </div>
             
             <div className="space-y-4">
               {doctors.length === 0 ? (
                 <p className="text-xs text-slate-500 text-center py-6">No active doctors on duty.</p>
               ) : (
                 doctors.map((doc) => {
                   // Calculate color load levels
                   const load = doc.active_load;
                   const dotColor = load >= 5 ? 'bg-rose-500' : load >= 2 ? 'bg-amber-500' : 'bg-emerald-500';
                   const loadText = load >= 5 ? 'High Load' : load >= 2 ? 'Moderate' : 'Optimal';
                   
                   return (
                     <div key={doc.id} className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex items-center justify-between">
                       <div>
                         <h4 className="font-bold text-sm text-white">{doc.full_name}</h4>
                         <p className="text-xs text-slate-500">{doc.specialization} &bull; Exp: {doc.years_of_experience} yrs</p>
                       </div>
                       <div className="text-right">
                         <span className="text-xs font-bold text-white block">{doc.active_load} Queue</span>
                         <span className="inline-flex items-center gap-1.5 mt-1">
                           <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{loadText}</span>
                         </span>
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
          </div>
        </div>

      </div>

      {/* Manual Check-in Slide-out Drawer Overlay */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-[#0a0a0a] border-l border-white/10 h-full p-8 md:p-10 flex flex-col justify-between overflow-y-auto animate-slide-in">
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <UserPlus className="text-indigo-500" size={24} />
                  <h3 className="text-xl font-black outfit tracking-tight text-white uppercase">Patient Manual Entry</h3>
                </div>
                <button onClick={() => setShowManualForm(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                    <span>Hospyn ID</span>
                    <span className="text-emerald-500 font-bold">OPTIONAL</span>
                  </label>
                  <input type="text" placeholder="e.g. PAT-999999" value={formData.hospyn_id} onChange={e => setFormData({...formData, hospyn_id: e.target.value})} className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 text-sm text-indigo-400 placeholder:text-indigo-400/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Name</label>
                    <input required type="text" placeholder="John" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Name</label>
                    <input required type="text" placeholder="Doe" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                  <input required type="tel" placeholder="+91 98765 43210" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</label>
                    <input required type="number" placeholder="32" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none appearance-none">
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason for Visit</label>
                  <textarea required placeholder="Short description of check-in purpose..." value={formData.reason_for_visit} onChange={e => setFormData({...formData, reason_for_visit: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none h-20" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Symptoms / Notes</label>
                  <textarea placeholder="e.g. Cough, high fever, diabetic history" value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none h-20" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority Level</label>
                  <select value={formData.priority_level} onChange={e => setFormData({...formData, priority_level: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none appearance-none">
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Clinical Emergency</option>
                  </select>
                </div>

                <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[11px] tracking-widest uppercase transition-all mt-4 shadow-lg shadow-indigo-600/10">
                  Add to Waiting Queue
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Route walk-in / Assign Doctor drawer modal */}
      {routingWalkin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold outfit text-white">Route Walk-In Request</h3>
              <button onClick={() => setRoutingWalkin(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-sm text-slate-400">Select where to route <span className="font-bold text-white">{routingWalkin.full_name}</span> (Queue #{routingWalkin.queue_number}).</p>

            <div className="space-y-4">
              <button 
                onClick={() => handleRouteWalkin('triage')} 
                className="w-full p-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-2xl flex items-center justify-between font-bold transition-all text-sm"
              >
                <span>Send to Nurse for Vitals (Triage Queue)</span>
                <ChevronRight size={18} />
              </button>
              
              <div className="border-t border-white/5 my-4 pt-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Direct To Doctor List</span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {doctors.map(doc => (
                    <button 
                      key={doc.id}
                      onClick={() => handleRouteWalkin('doctor', doc.id)}
                      className="w-full p-3.5 bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-left flex justify-between items-center transition-all text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{doc.full_name}</span>
                        <span className="text-slate-500 text-[10px]">{doc.specialization} &bull; Load: {doc.active_load}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Drawer Overlay */}
      {selectedWalkinForBilling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-[#0a0a0a] border-l border-white/10 h-full p-8 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <CreditCard className="text-indigo-500" size={24} />
                  <h3 className="text-xl font-bold outfit text-white uppercase">OP Payment Checkout</h3>
                </div>
                <button onClick={() => setSelectedWalkinForBilling(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Patient Name</span>
                  <span className="font-bold text-white">{selectedWalkinForBilling.full_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Queue Token</span>
                  <span className="font-mono font-bold text-indigo-400">#{selectedWalkinForBilling.queue_number}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Visit Charges</span>
                  <span className="font-bold text-white">INR {(selectedWalkinForBilling.billing_amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <form onSubmit={handleCollectPayment} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['cash', 'card', 'upi'] as const).map((method) => (
                      <button 
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-3.5 px-4 rounded-xl border text-xs font-bold uppercase transition-all ${
                          paymentMethod === method 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10' 
                            : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod !== 'cash' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaction Reference / UPI ID</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. TXN987654321" 
                      value={transactionRef} 
                      onChange={e => setTransactionRef(e.target.value)} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isProcessingPayment}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-black text-[11px] tracking-widest uppercase transition-all mt-4"
                >
                  {isProcessingPayment ? 'Processing...' : 'Collect & Mark Paid'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {receiptToPrint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold outfit text-white">Collect Payment Receipt</h3>
              <button onClick={() => setReceiptToPrint(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Print Content Area */}
            <div id="receipt-print-area" className="p-6 bg-white border border-slate-200 text-slate-900 rounded-2xl">
              <div className="text-center font-bold text-base mb-2">HOSPYN CLINICS</div>
              <div className="text-center text-[10px] text-slate-500 mb-4">INTAKE BILL RECEIPT</div>
              
              <div className="border-t border-dashed border-slate-300 my-2" />
              
              <div className="flex justify-between text-xs my-1">
                <span>Patient</span>
                <span className="font-bold">{receiptToPrint.full_name}</span>
              </div>
              <div className="flex justify-between text-xs my-1">
                <span>Phone</span>
                <span>{receiptToPrint.phone}</span>
              </div>
              <div className="flex justify-between text-xs my-1">
                <span>Queue Number</span>
                <span className="font-bold">Token #{receiptToPrint.queue_number}</span>
              </div>
              <div className="flex justify-between text-xs my-1">
                <span>Status</span>
                <span className="font-bold text-emerald-600">PAID</span>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2" />

              <div className="flex justify-between text-xs font-bold my-1">
                <span>OP Consultation Fee</span>
                <span>INR ${(receiptToPrint.billing_amount / 100).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 my-1">
                <span>Payment Method</span>
                <span className="uppercase">{receiptToPrint.payment_method || 'UPI/Cash'}</span>
              </div>
              {receiptToPrint.payment_reference && (
                <div className="flex justify-between text-[10px] text-slate-500 my-1">
                  <span>Txn Ref</span>
                  <span className="font-mono">{receiptToPrint.payment_reference}</span>
                </div>
              )}

              <div className="border-t border-dashed border-slate-300 my-3" />
              <div className="text-center text-[9px] text-slate-400">Thank you for visiting Hospyn Clinics.</div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={printReceipt} 
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button 
                onClick={() => setReceiptToPrint(null)} 
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 text-center">
            <div className="flex justify-between items-center text-left">
              <h3 className="text-lg font-bold outfit text-white">Hospital Intake QR Form</h3>
              <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 bg-white rounded-2xl inline-block mx-auto">
              {/* Fallback to simple simulated beautiful SVG QR visual if token exists */}
              {hospitalQrToken ? (
                <div className="space-y-4">
                  <svg className="w-48 h-48 mx-auto" viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#fff" />
                    {/* Simplified simulated clean QR dots */}
                    <path d="M5 5h30v30H5zm5 5h20v20H10zm0 10h10v10H10zm35-20h50v20H45v10H95V5H45zm5 25h10v10H50zm15 0h20v10H65zm-60 30h30v30H5zm5 5h20v20H10zm30 15h15v15H40zm20 5h10v10H60zm15-5h10v15H75zm10-15h10v10H85zm-5 25h15v5H80z" fill="#000" />
                  </svg>
                  <p className="text-[10px] text-slate-500 font-mono select-all break-all max-w-[240px] mx-auto">{hospitalQrToken}</p>
                </div>
              ) : (
                <p className="text-slate-500 text-xs py-10">Generating Token...</p>
              )}
            </div>

            <p className="text-xs text-slate-400">Patients scan this QR code to access the digital walk-in queue check-in form directly on their mobile device.</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceptionDashboard;
