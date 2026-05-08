import React from 'react';

const NurseDashboard: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Nurse Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-2">Hospital Status</h2>
          <p className="text-muted-foreground">🟢 All systems operational</p>
        </div>
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-2">Total Patients</h2>
          <p className="text-4xl font-bold">1,284</p>
        </div>
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-2">Active Staff</h2>
          <p className="text-4xl font-bold">42</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
