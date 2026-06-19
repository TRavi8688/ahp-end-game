import React, { useState } from 'react';
import apiClient from '../apiClient';

const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    hospitalName: '',
    address: '',
    departments: '',
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async () => {
    try {
      await apiClient.post('/hospital', formData);
      alert('Hospital setup successful!');
      // Redirect to admin dashboard
    } catch (error) {
      console.error('Setup failed', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="glass-card w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Hospital Setup Wizard</h1>
        
        <div className="flex justify-between mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 1: Hospital Details</h2>
            <input 
              className="w-full p-2 mb-4 bg-accent border border-border rounded" 
              placeholder="Hospital Name" 
              onChange={(e) => setFormData({...formData, hospitalName: e.target.value})}
            />
            <button className="btn-primary w-full" onClick={nextStep}>Next</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 2: Departments</h2>
            <textarea 
              className="w-full p-2 mb-4 bg-accent border border-border rounded" 
              placeholder="List departments (comma separated)" 
              rows={4}
              onChange={(e) => setFormData({...formData, departments: e.target.value})}
            />
            <div className="flex gap-4">
              <button className="btn-secondary w-full" onClick={prevStep}>Back</button>
              <button className="btn-primary w-full" onClick={nextStep}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 3: Review & Submit</h2>
            <div className="mb-4">
              <p><strong>Name:</strong> {formData.hospitalName}</p>
              <p><strong>Departments:</strong> {formData.departments}</p>
            </div>
            <div className="flex gap-4">
              <button className="btn-secondary w-full" onClick={prevStep}>Back</button>
              <button className="btn-primary w-full" onClick={handleSubmit}>Submit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
