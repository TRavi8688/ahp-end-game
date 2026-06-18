import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="glass-panel p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/30 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Partner Portal</h1>
            <p className="text-slate-400 text-center">Sign in to manage your medical services and operations.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input pl-11" 
                  placeholder="admin@pharmacy.com" 
                  required
                />
              </div>
            </div>

            <div className="space-y-1 relative">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs text-primary hover:text-primary-400 transition-colors">Forgot Password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input pl-11" 
                  placeholder="••••••••" 
                  required
                />
              </div>
            </div>

            <button type="submit" className="glass-button w-full flex items-center justify-center gap-2 mt-8">
              Sign In to Dashboard
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              Don't have a partner account?{' '}
              <Link to="/register" className="text-primary font-medium hover:text-primary-400 hover:underline transition-all">
                Apply now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
