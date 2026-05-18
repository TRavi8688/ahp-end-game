const React = require('react');
try {
  console.log('Testing imports...');
  const { StyleSheet } = require('react-native');
  console.log('StyleSheet exists:', !!StyleSheet);
  console.log('StyleSheet.create exists:', !!StyleSheet?.create);
  
  const App = require('./App').default;
  console.log('App component loaded successfully');
} catch (e) {
  console.error('FAILED TO LOAD APP:', e.message);
  console.error(e.stack);
}
