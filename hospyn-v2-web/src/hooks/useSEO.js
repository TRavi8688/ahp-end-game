// src/hooks/useSEO.js
// Usage: import useSEO from '../hooks/useSEO';
//        useSEO({ title: 'Privacy Policy', description: '...' });
//
// Requires react-helmet-async:
//   npm install react-helmet-async
//
// Wrap your app root (main.jsx) with <HelmetProvider>:
//   import { HelmetProvider } from 'react-helmet-async';
//   <HelmetProvider><App /></HelmetProvider>

import { useEffect } from 'react';

const BASE_TITLE = 'Hospyn — Smart Hospital Management';
const BASE_DESCRIPTION = "India's hospital management platform. Book appointments, manage records, AI-powered health assistance.";
const BASE_URL = 'https://hospyn.in';

/**
 * useSEO — lightweight per-page SEO updater (no extra library required).
 * Mutates <title>, meta description, canonical, and OG tags directly.
 *
 * @param {Object} options
 * @param {string} [options.title]        - Page-specific title (appended with site name)
 * @param {string} [options.description]  - Page-specific meta description
 * @param {string} [options.path]         - Canonical path e.g. '/privacy-policy'
 * @param {string} [options.image]        - OG image URL (defaults to /og-image.png)
 */
export default function useSEO({ title, description, path = '', image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · Hospyn` : BASE_TITLE;
    const fullDesc = description || BASE_DESCRIPTION;
    const canonical = `${BASE_URL}${path}`;
    const ogImage = image || `${BASE_URL}/og-image.png`;

    // Title
    document.title = fullTitle;

    // Helper to set or create a meta tag
    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [attrName, attrVal] = selector.replace('meta[', '').replace(']', '').split('=');
        el.setAttribute(attrName, attrVal.replace(/"/g, ''));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', fullDesc);
    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', fullDesc);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:image"]', 'content', ogImage);
    setMeta('meta[name="twitter:title"]', 'content', fullTitle);
    setMeta('meta[name="twitter:description"]', 'content', fullDesc);
    setMeta('meta[name="twitter:image"]', 'content', ogImage);

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // Cleanup: restore defaults on unmount
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title, description, path, image]);
}
