import { useState } from 'react';
import { api } from '../lib/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

const CONSENT_DEFINITIONS = [
  {
    type: 'data_processing',
    required: true,
    title: 'Healthcare Data Processing',
    description:
      'Allow Hospyn and your hospital to store and process your health records, ' +
      'appointments, and prescriptions in order to provide medical care. ' +
      'This is required to use the platform.',
    legal: 'Required under DPDP Act 2023, §6',
  },
  {
    type: 'telemedicine',
    required: false,
    title: 'Telemedicine Services',
    description:
      'Allow video and audio consultations with doctors through the Hospyn app. ' +
      'Session recordings are never stored without your separate consent.',
    legal: 'Optional',
  },
  {
    type: 'research',
    required: false,
    title: 'Anonymised Medical Research',
    description:
      'Allow your fully de-identified data to contribute to medical research. ' +
      'Your name and personal details are removed before any research use.',
    legal: 'Optional — data is anonymised per DPDP Act 2023, §3(t)',
  },
  {
    type: 'marketing',
    required: false,
    title: 'Health Tips & Communications',
    description:
      'Receive relevant health tips, appointment reminders, and service updates ' +
      'from Hospyn and your hospital via SMS or email.',
    legal: 'Optional — withdraw any time',
  },
];

// ─── Sub-component: single consent item ───────────────────────────────────────

function ConsentItem({ definition, checked, onChange }) {
  const { required, title, description, legal } = definition;

  return (
    <label
      className={`flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        checked
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${required && !checked ? 'border-red-200 bg-red-50' : ''}`}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={required && checked}   // can't un-check required once set (must revoke via settings)
          className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {required && (
            <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        <p className="text-xs text-gray-400 mt-1.5">{legal}</p>
      </div>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ConsentCollection
 *
 * Shown during patient registration (step before account creation is finalised).
 * Grants consent via POST /api/v1/consent/grant for each accepted type.
 *
 * Props:
 *   patientId   — UUID of the newly created (but not yet active) patient account
 *   hospitalId  — UUID of the hospital the patient is registering with
 *   onComplete  — callback(consents: Record<string, boolean>) called after all grants succeed
 */
export function ConsentCollection({ patientId, hospitalId, onComplete }) {
  const [consents, setConsents] = useState({
    data_processing: false,
    telemedicine: false,
    research: false,
    marketing: false,
  });

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [progress, setProgress] = useState('');

  const toggle = (type, value) =>
    setConsents((prev) => ({ ...prev, [type]: value }));

  const handleSubmit = async () => {
    if (!consents.data_processing) {
      setError(
        'You must accept Healthcare Data Processing consent to use Hospyn. ' +
        'This is required under the Digital Personal Data Protection Act 2023.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    const typesToGrant = Object.entries(consents)
      .filter(([, granted]) => granted)
      .map(([type]) => type);

    try {
      for (const consentType of typesToGrant) {
        setProgress(`Saving ${consentType.replace('_', ' ')} consent…`);
        await api.post('/api/v1/consent/grant', {
          patient_id:   patientId,
          hospital_id:  hospitalId,
          consent_type: consentType,
          version:      '1.0',
        });
      }
      setProgress('');
      onComplete(consents);
    } catch (err) {
      setError(`Failed to save consent: ${err.message}. Please try again.`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const allRequiredGranted = consents.data_processing;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🔒</span>
          <h2 className="text-xl font-bold text-gray-900">Your Data, Your Choice</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Under India's{' '}
          <a
            href="https://hospyn.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Digital Personal Data Protection Act 2023
          </a>
          , we need your explicit consent before processing your health data.
          You can change these preferences any time in Settings.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Consent items */}
      <div className="space-y-3 mb-6">
        {CONSENT_DEFINITIONS.map((def) => (
          <ConsentItem
            key={def.type}
            definition={def}
            checked={consents[def.type]}
            onChange={(v) => toggle(def.type, v)}
          />
        ))}
      </div>

      {/* Legal footer */}
      <p className="text-xs text-gray-400 mb-6 leading-relaxed">
        You may withdraw optional consents at any time from your account settings.
        Required consent (data processing) can be withdrawn by submitting a deletion
        request, which will close your account. Medical records required by law will
        be anonymised, not deleted.{' '}
        <a
          href="https://hospyn.com/legal/privacy-policy"
          className="text-blue-500 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy v1.0
        </a>
      </p>

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={!allRequiredGranted || loading}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          allRequiredGranted && !loading
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {loading
          ? progress || 'Saving consent…'
          : 'I Agree & Continue →'}
      </button>

      {!allRequiredGranted && (
        <p className="text-xs text-center text-red-500 mt-2">
          Please accept the required Healthcare Data Processing consent above.
        </p>
      )}
    </div>
  );
}
