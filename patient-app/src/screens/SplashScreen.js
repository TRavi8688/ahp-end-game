import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SecurityUtils } from '../utils/security';

// Import the cinematic splash to let Expo/Webpack handle the path bundling
import logo from '../../assets/logo.png';

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const checkSession = async () => {
      // Small delay to let splash animation breathe
      await new Promise(resolve => setTimeout(resolve, 3000));

      const token = await SecurityUtils.getToken();
      
      if (!token) {
        return navigation.replace('Login');
      }

      // If token exists, enable screen protection for medical data
      await SecurityUtils.enableScreenshotProtection();

      // Check for biometrics
      const bioAvailable = await SecurityUtils.isBiometricAvailable();
      if (bioAvailable) {
        const authenticated = await SecurityUtils.authenticateWithBiometrics();
        if (authenticated) {
          navigation.replace('MainTabs');
        } else {
          // If biometric fails, force re-login for security
          await SecurityUtils.deleteToken();
          navigation.replace('Login');
        }
      } else {
        // No biometrics enrolled, just go to main (or could prompt for custom PIN)
        navigation.replace('MainTabs');
      }
    };

    if (Platform.OS !== 'web') {
      checkSession();
    } else {
      const timer = setTimeout(() => {
        navigation.replace('Login');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [navigation]);

  if (Platform.OS === 'web') {
    // Resolve the actual URI of the logo for the web environment
    const logoUri = logo?.default || logo?.uri || logo || '';

    return (
      <div
        style={{ width: '100vw', height: '100vh', backgroundColor: '#050810', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: getSplashHtml(logoUri) }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.nativeLogo} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050810',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeLogo: {
    width: 250,
    height: 250,
    resizeMode: 'contain',
  },
});

const getSplashHtml = (logoUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Hospyn – Splash Screen</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Rajdhani:wght@300;400;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --red: #e8213a;
    --blue: #00b4f5;
    --dark: #050810;
    --glow-red: rgba(232, 33, 58, 0.55);
    --glow-blue: rgba(0, 180, 245, 0.55);
  }

  html, body {
    width: 100%; height: 100%;
    overflow: hidden;
    background: var(--dark);
    font-family: 'Rajdhani', sans-serif;
  }

  #particles {
    position: fixed; inset: 0; z-index: 0;
    pointer-events: none;
  }

  .splash-container {
    position: relative;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 2;
  }

  .logo-wrapper {
    position: relative;
    width: 280px; height: 280px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 40px;
  }

  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid transparent;
  }
  .ring-outer {
    width: 100%; height: 100%;
    border-top: 2px solid var(--red);
    border-bottom: 2px solid var(--blue);
    animation: spin 6s linear infinite;
    box-shadow: 0 0 15px var(--glow-red), inset 0 0 15px var(--glow-blue);
  }
  .ring-inner {
    width: 80%; height: 80%;
    border-left: 1px solid var(--blue);
    border-right: 1px solid var(--red);
    animation: spin-rev 4s linear infinite;
    opacity: 0.7;
  }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

  .logo-img {
    width: 160px; height: auto;
    z-index: 10;
    filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));
    animation: pulse 3s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.05); opacity: 1; }
  }

  .brand-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 4rem;
    font-weight: 300;
    letter-spacing: 12px;
    text-transform: uppercase;
    background: linear-gradient(90deg, #e8213a 0%, #ffffff 50%, #00b4f5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 15px;
    opacity: 0;
    animation: fadeInUp 1.2s ease forwards 0.5s;
  }



  .accent-line {
    width: 80px; height: 1px;
    background: linear-gradient(90deg, transparent, var(--red), var(--blue), transparent);
    margin: 25px 0;
    opacity: 0;
    animation: scaleX 1.5s ease forwards 1.2s;
  }

  .loading-dots {
    display: flex; gap: 8px;
    margin-top: 10px;
  }
  .dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: white;
    opacity: 0.3;
    animation: blink 1.4s infinite both;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleX { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
  @keyframes blink { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.8; } }

</style>
</head>
<body style="background-color: #050810;">

  <canvas id="particles"></canvas>

  <div class="splash-container">
    <div class="logo-wrapper">
      <div class="ring ring-outer"></div>
      <div class="ring ring-inner"></div>
      <img src="${logoUrl}" alt="Hospyn Logo" class="logo-img">
    </div>

    <h1 class="brand-name">Hospyn</h1>
    <div class="accent-line"></div>

    <div class="loading-dots">
      <div class="dot" style="background-color: var(--red);"></div>
      <div class="dot" style="background-color: var(--blue);"></div>
      <div class="dot" style="background-color: var(--red);"></div>
    </div>
  </div>

<script>
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = [];
    for(let i=0; i<100; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            color: Math.random() > 0.5 ? '#e8213a' : '#00b4f5'
        });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if(p.x > canvas.width) p.x = 0;
        if(p.x < 0) p.x = canvas.width;
        if(p.y > canvas.height) p.y = 0;
        if(p.y < 0) p.y = canvas.height;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.4;
        ctx.fill();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', init);
  init();
  animate();
</script>

</body>
</html>
`;

export default SplashScreen;
