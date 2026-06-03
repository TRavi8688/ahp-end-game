const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Hermes for web to prevent TypeError: StyleSheet.create is not a function
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
    hermes: false,
  },
});

// Impenetrable alias for web to guarantee react-native-web is always used
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto') {
    return {
      type: 'empty',
    };
  }
  if (platform === 'web' && moduleName === 'react-native') {
    return context.resolveRequest(context, 'react-native-web', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
