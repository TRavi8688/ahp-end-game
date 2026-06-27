import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import logoImg from '../assets/logo.png';

const Navbar = ({ onOpenWizard }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Ecosystem', path: '/' },
    { name: 'Platform', path: '/platform' },
    { name: 'Network', path: '/network' },
    { name: 'Vision', path: '/vision' },
  ];

  return (
    <nav className={`fixed top-0 left-0 w-full z-[1000] transition-all duration-500 ${scrolled ? 'py-4' : 'py-8'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={`glass-card !rounded-full px-8 py-3 flex items-center justify-between border-slate-200/50 backdrop-blur-md ${scrolled ? 'bg-white/80 shadow-lg shadow-blue-500/5' : 'bg-white/40'}`}>
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500 bg-slate-50 border border-slate-100">
               <img src={logoImg} alt="Hospain Original Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-2xl font-black outfit tracking-tighter text-slate-900">HOSPAIN<span className="text-primary">.</span></span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                to={link.path}
                className={`text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:text-primary ${location.pathname === link.path ? 'text-primary' : 'text-slate-500'}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenWizard}
              className="btn-premium hidden sm:flex !py-2.5 !px-6"
            >
              Activate Node
            </button>
            <button 
              className="md:hidden text-slate-800 p-2"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-24 left-6 right-6 glass-card bg-white/95 backdrop-blur-xl p-8 z-[999] border-slate-200"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path}
                  onClick={() => setMobileMenu(false)}
                  className={`text-lg font-black outfit tracking-tight transition-colors ${location.pathname === link.path ? 'text-primary' : 'text-slate-800 hover:text-primary'}`}
                >
                  {link.name}
                </Link>
              ))}
              <button 
                onClick={() => { onOpenWizard(); setMobileMenu(false); }}
                className="btn-premium w-full mt-4"
              >
                Activate Node
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
