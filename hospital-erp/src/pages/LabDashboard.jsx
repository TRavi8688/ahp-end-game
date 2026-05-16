import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Beaker, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Plus,
  ArrowRight,
  ClipboardList,
  Activity,
  User,
  Barcode,
  Save,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';

const LabDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [sampleId, setSampleId] = useState('');
  const [results, setResults] = useState([]);

  const fetchQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/lab/queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (err) {
      console.error("Queue fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCollect = async () => {
    if (!activeOrder || !sampleId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/lab/orders/${activeOrder.id}/collect?sample_id=${sampleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Sample registered successfully!");
      setShowCollectModal(false);
      setSampleId('');
      fetchQueue();
    } catch (err) {
      alert("Failed to register sample");
    }
  };

  const handleResultSubmit = async () => {
    if (!activeOrder) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/lab/orders/${activeOrder.id}/results`, {
        results: results
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Results finalized and patient notified!");
      setShowResultModal(false);
      setActiveOrder(null);
      fetchQueue();
    } catch (err) {
      alert("Failed to submit results");
    }
  };

  const initResultForm = (order) => {
    const initialResults = order.tests.map(t => ({
      test_name: t.test_name,
      value: '',
      unit: '',
      reference_range: '',
      is_abnormal: false,
      clinical_remarks: ''
    }));
    setResults(initialResults);
    setActiveOrder(order);
    setShowResultModal(true);
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit selection:bg-indigo-500/30">
      {/* Side Navigation */}
      <Sidebar />

      <main className="flex-1 ml-80 p-12 relative bg-[#050810] min-h-screen">
        <div className="erp-header flex justify-between items-center mb-10">
        <div className="header-left">
          <div className="header-icon lab">
            <FlaskConical size={24} color="#10B981" />
          </div>
          <div>
            <h1>Pathology Command</h1>
            <p>Diagnostic Lifecycle & Sample Tracking</p>
          </div>
        </div>
          <div className="header-right">
            <div className="stats-pill bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full border border-emerald-500/20 flex items-center gap-2 font-bold text-sm">
              <Activity size={16} />
              <span>{orders.length} Active Orders</span>
            </div>
          </div>
        </div>

      <div className="dashboard-grid">
        {/* Left: Lab Queue */}
        <div className="queue-sidebar glass-card">
          <div className="sidebar-header">
            <div className="search-box">
              <Search size={18} />
              <input type="text" placeholder="Search orders..." />
            </div>
          </div>

          <div className="queue-list scrollable">
            {loading ? (
              <div className="empty-state">SYNCING...</div>
            ) : orders.length > 0 ? (
              orders.map((order) => (
                <div 
                  key={order.id} 
                  className={`queue-item ${activeOrder?.id === order.id ? 'active' : ''}`}
                  onClick={() => setActiveOrder(order)}
                >
                  <div className="order-meta">
                    <span className="order-id">#{order.id.substring(0, 6).toUpperCase()}</span>
                    <span className={`status-tag ${order.status}`}>{order.status.toUpperCase()}</span>
                  </div>
                  <h3 className="patient-name">{order.patient_name}</h3>
                  <div className="test-preview">
                    <Beaker size={14} />
                    <span>{order.tests.length} Tests Ordered</span>
                  </div>
                  <div className="time-ago">
                    <Clock size={12} />
                    <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No pending lab orders</div>
            )}
          </div>
        </div>
      </main>
   {/* Right: Order Details & Action */}
        <div className="main-content glass-card">
          {activeOrder ? (
            <div className="order-details">
              <div className="content-header">
                <div className="patient-hero">
                  <div className="avatar-box">
                    <User size={30} />
                  </div>
                  <div>
                    <h2>{activeOrder.patient_name}</h2>
                    <p className="sub-text">Hospyn ID: {activeOrder.patient_id.substring(0, 8)}</p>
                  </div>
                </div>
                <div className="actions">
                  {activeOrder.status === 'ordered' && (
                    <button className="btn-primary collect" onClick={() => setShowCollectModal(true)}>
                      <Barcode size={18} />
                      <span>COLLECT SAMPLE</span>
                    </button>
                  )}
                  {activeOrder.status === 'collecting' && (
                    <button className="btn-primary results" onClick={() => initResultForm(activeOrder)}>
                      <Plus size={18} />
                      <span>SUBMIT RESULTS</span>
                    </button>
                  )}
                  {activeOrder.status === 'completed' && (
                    <div className="status-badge-final">
                      <CheckCircle2 size={20} />
                      <span>REPORT FINALIZED</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="test-list-section">
                <h3>PRESCRIBED DIAGNOSTICS</h3>
                <div className="test-grid">
                  {activeOrder.tests.map((test, i) => (
                    <div key={i} className="test-card">
                      <div className="test-icon">
                        <Activity size={16} />
                      </div>
                      <span className="test-name">{test.test_name}</span>
                    </div>
                  ))}
                </div>

                {activeOrder.sample_id && (
                  <div className="sample-info-bar">
                    <div className="info-item">
                      <label>SAMPLE UID</label>
                      <p>{activeOrder.sample_id}</p>
                    </div>
                    <div className="info-item border-l">
                      <label>COLLECTED AT</label>
                      <p>{new Date(activeOrder.collected_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="select-prompt">
              <div className="prompt-orb">
                <FlaskConical size={50} color="#1E293B" />
              </div>
              <h2>Laboratory Information System</h2>
              <p>Select an order from the queue to start sample processing.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: COLLECT SAMPLE */}
      {showCollectModal && (
        <div className="modal-overlay">
          <div className="modal-content small">
            <div className="modal-header">
              <h2>Sample Collection</h2>
              <button className="close-btn" onClick={() => setShowCollectModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="hint-text">Enter the barcode ID or unique vial ID for the sample.</p>
              <div className="input-group-modern">
                <Barcode size={20} />
                <input 
                  type="text" 
                  placeholder="Scan or Enter Sample ID..." 
                  value={sampleId}
                  onChange={(e) => setSampleId(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCollectModal(false)}>CANCEL</button>
              <button className="btn-confirm" onClick={handleCollect} disabled={!sampleId}>REGISTER SAMPLE</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT RESULTS */}
      {showResultModal && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>Diagnostic Result Entry</h2>
              <button className="close-btn" onClick={() => setShowResultModal(false)}>&times;</button>
            </div>
            <div className="modal-body scrollable-modal">
              {results.map((res, index) => (
                <div key={index} className="result-row-card">
                  <div className="row-header">
                    <h4>{res.test_name}</h4>
                    <div className="abnormal-toggle">
                      <label>Mark Abnormal</label>
                      <input 
                        type="checkbox" 
                        checked={res.is_abnormal}
                        onChange={(e) => {
                          const newRes = [...results];
                          newRes[index].is_abnormal = e.target.checked;
                          setResults(newRes);
                        }}
                      />
                    </div>
                  </div>
                  <div className="row-inputs">
                    <div className="input-field">
                      <label>VALUE</label>
                      <input 
                        placeholder="e.g. 14.5" 
                        value={res.value}
                        onChange={(e) => {
                          const newRes = [...results];
                          newRes[index].value = e.target.value;
                          setResults(newRes);
                        }}
                      />
                    </div>
                    <div className="input-field">
                      <label>UNIT</label>
                      <input 
                        placeholder="e.g. g/dL" 
                        value={res.unit}
                        onChange={(e) => {
                          const newRes = [...results];
                          newRes[index].unit = e.target.value;
                          setResults(newRes);
                        }}
                      />
                    </div>
                    <div className="input-field">
                      <label>REF RANGE</label>
                      <input 
                        placeholder="e.g. 13.5 - 17.5" 
                        value={res.reference_range}
                        onChange={(e) => {
                          const newRes = [...results];
                          newRes[index].reference_range = e.target.value;
                          setResults(newRes);
                        }}
                      />
                    </div>
                  </div>
                  <div className="remarks-field">
                    <label>CLINICAL REMARKS</label>
                    <textarea 
                      placeholder="Add technician remarks..." 
                      value={res.clinical_remarks}
                      onChange={(e) => {
                        const newRes = [...results];
                        newRes[index].clinical_remarks = e.target.value;
                        setResults(newRes);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowResultModal(false)}>CANCEL</button>
              <button className="btn-confirm results" onClick={handleResultSubmit}>FINALIZE REPORT & SIGN</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .erp-dashboard { padding: 40px; color: #fff; min-height: 100vh; background: #050810; }
        .erp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .header-left { display: flex; gap: 20px; align-items: center; }
        .header-icon.lab { width: 50px; height: 50px; border-radius: 15px; background: rgba(16, 185, 129, 0.1); display: flex; justify-content: center; align-items: center; border: 1px solid rgba(16, 185, 129, 0.2); }
        h1 { font-size: 24px; font-weight: 900; letter-spacing: -1px; }
        .dashboard-grid { display: grid; grid-template-columns: 400px 1fr; gap: 30px; height: calc(100vh - 200px); }
        .glass-card { background: #0f172a; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; display: flex; flex-direction: column; }
        .sidebar-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .search-box { background: rgba(0,0,0,0.2); padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; gap: 10px; color: #475569; }
        .search-box input { background: transparent; border: none; color: #fff; outline: none; flex: 1; font-size: 14px; }
        .queue-list { flex: 1; padding: 15px; }
        .scrollable { overflow-y: auto; }
        .queue-item { padding: 20px; border-radius: 20px; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
        .queue-item:hover { background: rgba(255,255,255,0.02); }
        .queue-item.active { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }
        .order-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .order-id { font-family: monospace; color: #475569; font-weight: bold; font-size: 12px; }
        .status-tag { font-size: 9px; font-weight: 900; padding: 4px 8px; border-radius: 6px; letter-spacing: 1px; }
        .status-tag.ordered { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .status-tag.collecting { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-tag.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .patient-name { font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #f1f5f9; }
        .test-preview, .time-ago { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; margin-top: 4px; }
        .main-content { padding: 40px; position: relative; }
        .select-prompt { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #1e293b; }
        .prompt-orb { width: 120px; height: 120px; border-radius: 60px; background: rgba(255,255,255,0.02); display: flex; justify-content: center; align-items: center; margin-bottom: 30px; }
        .content-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .patient-hero { display: flex; gap: 20px; align-items: center; }
        .avatar-box { width: 64px; height: 64px; border-radius: 32px; background: #1e293b; display: flex; justify-content: center; align-items: center; color: #10B981; }
        .btn-primary { padding: 14px 28px; border-radius: 16px; border: none; color: #fff; font-weight: bold; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-primary.collect { background: #f59e0b; box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.3); }
        .btn-primary.results { background: #10B981; box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.3); }
        .test-list-section h3 { font-size: 12px; font-weight: 900; color: #475569; letter-spacing: 2px; margin-bottom: 20px; }
        .test-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 40px; }
        .test-card { padding: 15px 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; display: flex; align-items: center; gap: 15px; }
        .test-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; justify-content: center; align-items: center; color: #10b981; }
        .sample-info-bar { display: flex; background: rgba(16, 185, 129, 0.05); padding: 25px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.1); }
        .info-item { flex: 1; padding: 0 25px; }
        .info-item label { display: block; font-size: 9px; font-weight: 900; color: #059669; letter-spacing: 1px; margin-bottom: 5px; }
        .info-item p { font-size: 18px; font-weight: bold; color: #fff; }
        .border-l { border-left: 1px solid rgba(255,255,255,0.1); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 40px; }
        .modal-content { background: #0f172a; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; max-height: 100%; }
        .modal-content.small { width: 450px; }
        .modal-content.large { width: 1000px; }
        .modal-header { padding: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 30px; flex: 1; }
        .scrollable-modal { overflow-y: auto; padding-right: 15px; }
        .input-group-modern { background: rgba(0,0,0,0.2); border: 2px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 15px 25px; display: flex; align-items: center; gap: 15px; margin-top: 20px; }
        .input-group-modern input { background: transparent; border: none; color: #fff; flex: 1; font-size: 18px; font-weight: bold; outline: none; }
        .result-row-card { background: rgba(255,255,255,0.02); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); padding: 25px; margin-bottom: 20px; }
        .row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .row-header h4 { font-size: 18px; font-weight: bold; color: #10B981; }
        .row-inputs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .input-field label, .remarks-field label { font-size: 9px; font-weight: 900; color: #475569; letter-spacing: 1px; margin-bottom: 8px; display: block; }
        .input-field input, .remarks-field textarea { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 15px; color: #fff; font-weight: bold; outline: none; }
        .remarks-field textarea { min-height: 60px; resize: none; font-weight: normal; }
        .modal-footer { padding: 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 15px; }
        .btn-cancel { background: transparent; border: none; color: #64748b; font-weight: bold; cursor: pointer; }
        .btn-confirm { padding: 12px 30px; border-radius: 12px; border: none; background: #6366F1; color: #fff; font-weight: bold; cursor: pointer; }
        .btn-confirm.results { background: #10B981; }
      `}</style>
    </div>
  );
};

export default LabDashboard;
