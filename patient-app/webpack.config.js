const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');

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

  // Explicitly inject EXPO_PUBLIC_ variables into the bundle
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_API_BASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_BASE_URL || "https://hospyn-495906-api-625745217419.asia-south1.run.app/api/v1"),
      'process.env.EXPO_PUBLIC_ENVIRONMENT': JSON.stringify(process.env.EXPO_PUBLIC_ENVIRONMENT || "production"),
      'process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com"),
    })
  );

  return config;
};
