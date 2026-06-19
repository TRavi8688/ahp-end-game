import { useState, useEffect } from 'react';
import { Pill, LayoutDashboard, Plus, RefreshCw, Archive } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../apiClient';

export default function PharmacyStockEntry() {
  const user = useAuthStore((s) => s.user);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(null); // stores item object
  
  // Forms state
  const [addForm, setAddForm] = useState({
    item_name: '', generic_name: '', category: 'Antibiotic', 
    batch_number: '', expiry_date: '', unit_price: '', stock_quantity: ''
  });
  
  const [updateForm, setUpdateForm] = useState({
    stock_quantity: '', unit_price: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      // Fetching real inventory data
      const res = await apiClient.get('/pharmacy/inventory');
      setInventory(res.data);
    } catch (err) {
      console.error("Failed to load real inventory data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...addForm,
        unit_price: parseFloat(addForm.unit_price),
        stock_quantity: parseInt(addForm.stock_quantity, 10),
        expiry_date: new Date(addForm.expiry_date).toISOString(),
      };
      
      await apiClient.post(`/pharmacy/inventory`, payload);
      alert('Stock successfully recorded into the immutable ledger!');
      setShowAddModal(false);
      setAddForm({ item_name: '', generic_name: '', category: 'Antibiotic', batch_number: '', expiry_date: '', unit_price: '', stock_quantity: '' });
      fetchInventory(); // Refresh
    } catch (error) {
      console.error("Failed to post inventory", error);
      alert('Error recording stock. Ensure you have proper permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!showUpdateModal) return;
    
    try {
      setSubmitting(true);
      const payload = {
        stock_quantity: parseInt(updateForm.stock_quantity, 10),
        unit_price: updateForm.unit_price ? parseFloat(updateForm.unit_price) : undefined
      };
      
      await apiClient.put(`/pharmacy/inventory/${showUpdateModal.id}`, payload);
      alert('Stock successfully updated!');
      setShowUpdateModal(null);
      setUpdateForm({ stock_quantity: '', unit_price: '' });
      fetchInventory(); // Refresh
    } catch (error) {
      console.error("Failed to update inventory", error);
      alert('Error updating stock. Ensure you have proper permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (item) => {
    setShowUpdateModal(item);
    setUpdateForm({
      stock_quantity: item.quantity || item.stock_quantity,
      unit_price: item.unit_price
    });
  };

  if (loading) return <div style={styles.page}><div className="spinner" /> Synchronizing Live Inventory Data...</div>;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <LayoutDashboard size={28} style={{ color: 'var(--color-brand)' }} />
            Pharmacy Stock Manager
          </h1>
          <p className="text-secondary" style={{margin: '0.5rem 0 0 0'}}>Strict Zero-Mock telemetry. Data flows directly to God Mode dashboard.</p>
        </div>
        
        <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16}/> Add New Medicine
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item Name</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Batch</th>
              <th style={styles.th}>In Stock</th>
              <th style={styles.th}>Unit Price</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>No inventory found for this hospital.</td></tr>
            ) : inventory.map(item => (
              <tr key={item.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{fontWeight: 600}}>{item.item_name}</div>
                  <div style={{fontSize: '0.8rem', color: '#666'}}>{item.generic_name}</div>
                </td>
                <td style={styles.td}>{item.category}</td>
                <td style={styles.td}>{item.batch_number}</td>
                <td style={styles.td}>
                  <div style={styles.badge(item.quantity || item.stock_quantity, item.min_stock_level)}>
                    {item.quantity || item.stock_quantity}
                  </div>
                </td>
                <td style={styles.td}>₹{item.unit_price}</td>
                <td style={styles.td}>
                  <button className="btn btn--ghost" style={{padding: '0.5rem', color: 'var(--color-brand)'}} onClick={() => openUpdateModal(item)}>
                    <RefreshCw size={16}/> Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{marginTop: 0}}>Add New Stock Shipment</h2>
            <form onSubmit={handleAddItem} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              
              <div style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Brand Name</label>
                  <input required type="text" style={styles.input} value={addForm.item_name} onChange={e => setAddForm({...addForm, item_name: e.target.value})} placeholder="Dolo 650" />
                </div>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Generic Name</label>
                  <input required type="text" style={styles.input} value={addForm.generic_name} onChange={e => setAddForm({...addForm, generic_name: e.target.value})} placeholder="Paracetamol" />
                </div>
              </div>
              
              <div style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Category</label>
                  <select style={styles.input} value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})}>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antacid">Antacid</option>
                    <option value="Supplement">Supplement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Batch No.</label>
                  <input required type="text" style={styles.input} value={addForm.batch_number} onChange={e => setAddForm({...addForm, batch_number: e.target.value})} placeholder="B1093" />
                </div>
              </div>
              
              <div style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Quantity (Strips/Units)</label>
                  <input required type="number" style={styles.input} value={addForm.stock_quantity} onChange={e => setAddForm({...addForm, stock_quantity: e.target.value})} placeholder="500" />
                </div>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Unit Price (₹)</label>
                  <input required type="number" step="0.1" style={styles.input} value={addForm.unit_price} onChange={e => setAddForm({...addForm, unit_price: e.target.value})} placeholder="35.5" />
                </div>
              </div>

              <div>
                <label style={styles.label}>Expiry Date</label>
                <input required type="date" style={styles.input} value={addForm.expiry_date} onChange={e => setAddForm({...addForm, expiry_date: e.target.value})} />
              </div>
              
              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" className="btn" style={{flex: 1}} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{flex: 1}} disabled={submitting}>
                  {submitting ? 'Committing...' : 'Push to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{marginTop: 0}}>Update Stock: {showUpdateModal.item_name}</h2>
            <form onSubmit={handleUpdateItem} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              
              <div>
                <label style={styles.label}>New Stock Quantity</label>
                <input required type="number" style={styles.input} value={updateForm.stock_quantity} onChange={e => setUpdateForm({...updateForm, stock_quantity: e.target.value})} />
              </div>
              
              <div>
                <label style={styles.label}>Unit Price (Optional Update)</label>
                <input type="number" step="0.1" style={styles.input} value={updateForm.unit_price} onChange={e => setUpdateForm({...updateForm, unit_price: e.target.value})} />
              </div>
              
              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" className="btn" style={{flex: 1}} onClick={() => setShowUpdateModal(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{flex: 1}} disabled={submitting}>
                  {submitting ? 'Committing...' : 'Push Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  tableContainer: { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, color: '#475569' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '1rem 1.5rem', color: '#1e293b' },
  badge: (qty, min) => {
    const isLow = qty <= (min || 10);
    return {
      display: 'inline-block',
      fontSize: '0.85rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: '1rem',
      background: isLow ? 'var(--color-danger-muted)' : 'var(--color-success-muted)',
      color: isLow ? 'var(--color-danger)' : 'var(--color-success)',
    };
  },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' },
  input: { width: '100%', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem' }
};
