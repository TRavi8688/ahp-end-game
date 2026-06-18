import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useAuthStore from "../store/authStore";

const AUTH_BASE = import.meta.env.VITE_AUTH_URL || "http://localhost:8001";
const ALLOWED_ROLES = ["hr", "admin", "hr_manager"];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    if (!phone.trim()) return setError("Enter a phone number");
    setLoading(true);
    setError("");
    try {
      await axios.post(`${AUTH_BASE}/api/v1/auth/send-otp`, { phone });
      setStep("otp");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return setError("Enter the OTP");
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${AUTH_BASE}/api/v1/auth/verify-otp`, {
        phone,
        otp,
      });
      const { access_token, user, hospital_id } = res.data;

      if (!ALLOWED_ROLES.includes(user?.role)) {
        setError("Access denied. HR Portal is for HR staff only.");
        setLoading(false);
        return;
      }

      login(access_token, user, hospital_id);
      navigate("/staff");
    } catch (e) {
      setError(e?.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">AHP</h1>
          <p className="text-gray-500 text-sm mt-1">HR Portal</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {step === "phone" ? "Sign In" : "Enter OTP"}
        </h2>

        {step === "phone" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                type="tel"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Send OTP
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              OTP sent to <span className="font-medium text-gray-700">{phone}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OTP
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 tracking-widest text-center text-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                maxLength={6}
                type="number"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Verify & Sign In
            </button>
            <button
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600"
            >
              ← Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
