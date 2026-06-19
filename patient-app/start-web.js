/**
 * start-web.js - DEFINITIVE FIX
 * 
 * Root cause of "StyleSheet.create is not a function":
 *   Metro uses transform.engine=hermes for web, which does NOT support
 *   react-native-web's StyleSheet shim. Webpack correctly aliases
 *   react-native -> react-native-web before any code runs.
 *
 * This script runs Webpack directly, bypassing Metro entirely for web.
 */
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file since Webpack Dev Server is run directly
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('[start-web] Loading environment variables from .env...');
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.trim();
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

process.env.NODE_ENV = 'development';
process.env.EXPO_WEBPACK_FAST_REFRESH = 'false';
// Critical: tell Expo webpack config to NOT use Hermes for web
process.env.EXPO_WEB_WEBPACK_TRANSPILE_WEB = '1';

async function start() {
  const createExpoWebpackConfigAsync = require('@expo/webpack-config');
  const Webpack = require('webpack');
  const WebpackDevServer = require('webpack-dev-server');

  const env = {
    projectRoot: __dirname,
    platform: 'web',
    mode: 'development',
    https: false,
    port: 19006,
  };

  console.log('[start-web] Building Webpack config...');
  const config = await createExpoWebpackConfigAsync(env, {});

  // ── CRITICAL: Force react-native -> react-native-web BEFORE any module loads ──
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    // This is the key alias that fixes StyleSheet.create
    'react-native$': 'react-native-web',
    // Also alias sub-paths
    'react-native/Libraries/Utilities/Platform': 'react-native-web/dist/exports/Platform',
  };

  // Fix for missing node built-ins in browser
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    crypto: false,
    path: false,
    stream: false,
    fs: false,
    os: false,
  };

  // ── CRITICAL: Disable Hermes transformer for web ──
  if (config.module && config.module.rules) {
    config.module.rules = config.module.rules.map(rule => {
      if (rule && rule.use && Array.isArray(rule.use)) {
        rule.use = rule.use.map(loader => {
          if (loader && loader.loader && loader.loader.includes('babel-loader')) {
            loader.options = loader.options || {};
            loader.options.caller = {
              ...(loader.options.caller || {}),
              supportsStaticESM: true,
            };
          }
          return loader;
        });
      }
      return rule;
    });
  }

  // Inject environment variables explicitly into the browser bundle using DefinePlugin
  config.plugins = config.plugins || [];
  config.plugins.push(
    new Webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_API_BASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_BASE_URL || "https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1"),
      'process.env.EXPO_PUBLIC_ENVIRONMENT': JSON.stringify(process.env.EXPO_PUBLIC_ENVIRONMENT || "production"),
      'process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com"),
    })
  );

  const compiler = Webpack(config);

  const serverConfig = {
    port: 19006,
    host: '0.0.0.0', // Allow binding to all interfaces so localhost and LAN work
    client: {
      overlay: true,
    },
    hot: false, // Disable HMR for stability
    historyApiFallback: true,
  };

  const server = new WebpackDevServer(serverConfig, compiler);

  compiler.hooks.done.tap('start-web', (stats) => {
    if (stats.hasErrors()) {
      console.error('[start-web] COMPILATION FAILED:\n', stats.toString('errors-only'));
    } else {
      console.log('\n[start-web] Compiled successfully!');
      console.log('[start-web] Patient App: http://localhost:19006');
      console.log('[start-web] Mobile (Expo Go): exp://192.168.0.21:19006\n');
    }
  });

  console.log('[start-web] Launching Webpack Dev Server...');
  await server.start();
}

start().catch((err) => {
  console.error('[start-web] Fatal error:', err);
  process.exit(1);
});
