import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

/**
 * Global Error Boundary
 * Catches uncaught UI errors in the component tree and displays a fallback UI
 * to prevent the entire app from crashing (white screen of death).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service like Sentry here
    console.error('[ErrorBoundary] Uncaught UI Error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Oops! Something went wrong.</Text>
            <Text style={styles.message}>
              We've encountered an unexpected issue. Please try restarting the app or resetting the session.
            </Text>
            
            {/* Show error details only in development (optional, but helpful for debugging) */}
            <View style={styles.errorBox}>
                <Text style={styles.errorText} numberOfLines={5}>
                    {this.state.error && this.state.error.toString()}
                </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={this.resetError}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children; 
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050810', // Dark theme background
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F87171', // Red color for error
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#94A3B8', // Muted text
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#FCA5A5',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#7C3AED', // Primary brand color
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
