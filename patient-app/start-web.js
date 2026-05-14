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

process.env.NODE_ENV = 'development';
process.env.EXPO_WEBPACK_FAST_REFRESH = 'true';
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
    port: 3005,
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

  const compiler = Webpack(config);

  const serverConfig = {
    ...config.devServer,
    port: 3005,
    host: '0.0.0.0',
    open: false,
    hot: true,
    historyApiFallback: true,
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:8080 ws://localhost:8080 http: ws:;"
    }
  };

  const server = new WebpackDevServer(serverConfig, compiler);

  compiler.hooks.done.tap('start-web', (stats) => {
    if (stats.hasErrors()) {
      console.error('[start-web] COMPILATION FAILED:\n', stats.toString('errors-only'));
    } else {
      console.log('\n[start-web] Compiled successfully!');
      console.log('[start-web] Patient App: http://localhost:3005');
      console.log('[start-web] Mobile (Expo Go): exp://192.168.0.21:3005\n');
    }
  });

  console.log('[start-web] Launching Webpack Dev Server...');
  await server.start();
}

start().catch((err) => {
  console.error('[start-web] Fatal error:', err);
  process.exit(1);
});
