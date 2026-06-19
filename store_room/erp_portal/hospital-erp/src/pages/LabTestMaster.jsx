import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Plus, 
  Save, 
  Trash2, 
  Settings2, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import apiClient from '../apiClient';
import Sidebar from '../components/Sidebar';

const LabTestMaster = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    test_name: '',
    category: '',
    base_price: '',
    unit: '',
    reference_range_min: '',
    reference_range_max: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/lab/tests');
      setTests(res.data);
    } catch (err) {
      console.error("Failed to fetch lab tests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        test_name: formData.test_name,
        category: formData.category,
        base_price: parseFloat(formData.base_price) || 0,
        unit: formData.unit || null,
        reference_range_min: formData.reference_range_min ? parseFloat(formData.reference_range_min) : null,
        reference_range_max: formData.reference_range_max ? parseFloat(formData.reference_range_max) : null,
        is_active: true
      };
      
      await apiClient.post('/lab/tests', payload);
      alert('Test configured successfully');
      setShowModal(false);
      setFormData({
        test_name: '', category: '', base_price: '', unit: '', reference_range_min: '', reference_range_max: ''
      });
      fetchTests();
    } catch (err) {
      alert('Failed to configure test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit selection:bg-indigo-500/30">
      <Sidebar />

      <main className="flex-1 ml-80 p-12 relative bg-[#050810] min-h-screen">
        <div className="erp-header flex justify-between items-center mb-10">
          <div className="header-left flex gap-5 items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Settings2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Diagnostic Directory</h1>
              <p className="text-slate-500 font-medium text-sm">Configure Lab Test Pricing & Reference Ranges</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-sm tracking-widest uppercase transition-all flex items-center gap-2">
            <Plus size={18} />
            Add Test Profile
          </button>
        </div>

        <div className="bg-[#0f172a] border border-white/5 rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Test Name</th>
                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Category</th>
                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Base Price (INR)</th>
                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ref Range</th>
                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="py-10 text-center text-slate-500">Loading Directory...</td></tr>
              ) : tests.length === 0 ? (
                <tr><td colSpan="5" className="py-10 text-center text-slate-500">No diagnostic tests configured. Add one to get started.</td></tr>
              ) : (
                tests.map((test) => (
                  <tr key={test.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-3">
                        <FlaskConical size={16} className="text-indigo-400" />
                        <span className="font-bold text-white">{test.test_name}</span>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-slate-400 font-medium">{test.category}</td>
                    <td className="py-5 px-8 text-emerald-400 font-black">₹{test.base_price.toFixed(2)}</td>
                    <td className="py-5 px-8 text-slate-400">
                      {test.reference_range_min !== null && test.reference_range_max !== null
                        ? `${test.reference_range_min} - ${test.reference_range_max} ${test.unit || ''}`
                        : 'N/A'
                      }
                    </td>
                    <td className="py-5 px-8">
                      {test.is_active ? (
                         <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg uppercase tracking-widest">Active</span>
                      ) : (
                         <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-black rounded-lg uppercase tracking-widest">Disabled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white outfit">Configure Test Profile</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Master Directory Setup</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test Name <span className="text-rose-500">*</span></label>
                  <input required name="test_name" value={formData.test_name} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. Complete Blood Count" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category <span className="text-rose-500">*</span></label>
                  <input required name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. Hematology" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Price (INR) <span className="text-rose-500">*</span></label>
                  <input required type="number" step="0.01" name="base_price" value={formData.base_price} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. 500.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Measurement Unit</label>
                  <input name="unit" value={formData.unit} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. mg/dL" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reference Min</label>
                  <input type="number" step="any" name="reference_range_min" value={formData.reference_range_min} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. 13.5" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reference Max</label>
                  <input type="number" step="any" name="reference_range_max" value={formData.reference_range_max} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. 17.5" />
                </div>
              </div>

              <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl text-slate-400 hover:text-white font-bold text-sm tracking-widest uppercase transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-sm tracking-widest uppercase transition-all flex items-center gap-2">
                  <Save size={18} />
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabTestMaster;
