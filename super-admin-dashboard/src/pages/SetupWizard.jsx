import { useState, useEffect, useRef } from "react";
import apiClient from "../services/apiClient";

// ─── Mini confetti canvas ─────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 12 + 5,
      h: Math.random() * 6 + 3,
      color: ["#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa"][
        Math.floor(Math.random() * 5)
      ],
      speed: Math.random() * 3 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    }));

    let running = true;
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.speed;
        p.angle += p.spin;
        if (p.y > canvas.height) p.y = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(draw);
    };
    draw();
    const t = setTimeout(() => { running = false; }, 4000);
    return () => { running = false; clearTimeout(t); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ opacity: 0.85 }}
    />
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ data, setData }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name *</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data.name || ""}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          placeholder="City Care Hospital"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={data.address || ""}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          placeholder="123 Main Street, City, State"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data.type || ""}
          onChange={(e) => setData({ ...data, type: e.target.value })}
        >
          <option value="">Select type</option>
          <option value="clinic">Clinic</option>
          <option value="hospital">Hospital</option>
          <option value="multispecialty">Multispecialty</option>
        </select>
      </div>
    </div>
  );
}

function Step2({ data, setData }) {
  const addWard = () =>
    setData({ ...data, wards: [...(data.wards || []), { name: "", beds: "" }] });
  const updateWard = (i, field, val) => {
    const wards = [...(data.wards || [])];
    wards[i] = { ...wards[i], [field]: val };
    setData({ ...data, wards });
  };
  const removeWard = (i) => {
    const wards = (data.wards || []).filter((_, idx) => idx !== i);
    setData({ ...data, wards });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Add wards and their bed capacity.</p>
      <div className="space-y-3">
        {(data.wards || []).map((ward, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ward name (e.g. General Ward)"
              value={ward.name}
              onChange={(e) => updateWard(i, "name", e.target.value)}
            />
            <input
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Beds"
              type="number"
              min="1"
              value={ward.beds}
              onChange={(e) => updateWard(i, "beds", e.target.value)}
            />
            <button
              onClick={() => removeWard(i)}
              className="text-red-400 hover:text-red-600 font-bold text-lg px-1"
            >×</button>
          </div>
        ))}
      </div>
      <button
        onClick={addWard}
        className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        + Add Ward
      </button>
    </div>
  );
}

function Step3({ data, setData }) {
  const addRoom = () =>
    setData({ ...data, otRooms: [...(data.otRooms || []), { name: "", equipment: "" }] });
  const updateRoom = (i, field, val) => {
    const otRooms = [...(data.otRooms || [])];
    otRooms[i] = { ...otRooms[i], [field]: val };
    setData({ ...data, otRooms });
  };
  const removeRoom = (i) => {
    const otRooms = (data.otRooms || []).filter((_, idx) => idx !== i);
    setData({ ...data, otRooms });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Add operation theatre rooms and equipment lists.</p>
      <div className="space-y-4">
        {(data.otRooms || []).map((room, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Room name (e.g. OT-1)"
                value={room.name}
                onChange={(e) => updateRoom(i, "name", e.target.value)}
              />
              <button onClick={() => removeRoom(i)} className="text-red-400 hover:text-red-600 font-bold text-lg px-1">×</button>
            </div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Equipment (e.g. Anesthesia machine, Monitor)"
              value={room.equipment}
              onChange={(e) => updateRoom(i, "equipment", e.target.value)}
            />
          </div>
        ))}
      </div>
      <button onClick={addRoom} className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
        + Add OT Room
      </button>
    </div>
  );
}

function Step4({ data, setData }) {
  const depts = ["pharmacy", "lab", "radiology", "physiotherapy", "blood_bank"];
  const toggle = (dept) => {
    const enabled = new Set(data.departments || []);
    enabled.has(dept) ? enabled.delete(dept) : enabled.add(dept);
    setData({ ...data, departments: [...enabled] });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Enable the departments available at your facility.</p>
      <div className="space-y-3">
        {depts.map((dept) => (
          <label key={dept} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={(data.departments || []).includes(dept)}
              onChange={() => toggle(dept)}
            />
            <span className="text-gray-700 capitalize">{dept.replace("_", " ")}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Step5({ data, setData }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Full Name *</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data.adminName || ""}
          onChange={(e) => setData({ ...data, adminName: e.target.value })}
          placeholder="Dr. Ramesh Sharma"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data.adminPhone || ""}
          onChange={(e) => setData({ ...data, adminPhone: e.target.value })}
          placeholder="+91 9876543210"
          type="tel"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data.adminRole || ""}
          onChange={(e) => setData({ ...data, adminRole: e.target.value })}
        >
          <option value="">Select role</option>
          <option value="admin">Admin</option>
          <option value="medical_director">Medical Director</option>
          <option value="hospital_manager">Hospital Manager</option>
        </select>
      </div>
    </div>
  );
}

// ─── Main SetupWizard ─────────────────────────────────────────────────────────
const STEPS = [
  { label: "Basic Info", title: "Hospital Information" },
  { label: "Wards", title: "Configure Wards" },
  { label: "OT Rooms", title: "Configure OT Rooms" },
  { label: "Departments", title: "Enable Departments" },
  { label: "Admin User", title: "First Admin User" },
];

export default function SetupWizard({ hospitalId, onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const saveStep = async (stepIndex) => {
    setLoading(true);
    setError("");
    try {
      await apiClient.post(
        `/hospitals/${hospitalId}/setup/step-${stepIndex + 1}`,
        data
      );
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save. Please try again.");
      setLoading(false);
      return false;
    }
    setLoading(false);
    return true;
  };

  const handleNext = async () => {
    const ok = await saveStep(step);
    if (!ok) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
      onComplete?.();
    }
  };

  if (done) {
    return (
      <>
        <Confetti />
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
            <p className="text-gray-500">Your hospital is ready to go.</p>
          </div>
        </div>
      </>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-6 md:p-8">
          {/* Step indicators */}
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i < step
                      ? "bg-blue-600 text-white"
                      : i === step
                      ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span className="hidden sm:block text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-5">
            {STEPS[step].title}
          </h2>

          {/* Step content */}
          {step === 0 && <Step1 data={data} setData={setData} />}
          {step === 1 && <Step2 data={data} setData={setData} />}
          {step === 2 && <Step3 data={data} setData={setData} />}
          {step === 3 && <Step4 data={data} setData={setData} />}
          {step === 4 && <Step5 data={data} setData={setData} />}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || loading}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {step === STEPS.length - 1 ? "Finish Setup" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
