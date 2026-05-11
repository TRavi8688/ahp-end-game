const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // ── CRITICAL: Force react-native -> react-native-web for static build ──
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'react-native$': 'react-native-web',
    'react-native/Libraries/Utilities/Platform': 'react-native-web/dist/exports/Platform',
  };

  // Custom Webpack fix for Hospyn Security Portal
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: false,
    path: false,
    stream: false,
  };

  return config;
};
