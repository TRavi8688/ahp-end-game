import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Hospain Patient Error Boundary Caught:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.icon}>⚠️</Text>
                    <Text style={styles.title}>Interface Disruption</Text>
                    <Text style={styles.message}>
                        We encountered an unexpected error loading this screen. Your medical records remain secure and untouched.
                    </Text>
                    
                    <TouchableOpacity 
                        style={styles.button} 
                        onPress={() => window.location ? window.location.href = '/' : null}
                    >
                        <Text style={styles.buttonText}>Return to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children; 
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#070D17',
    },
    icon: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        fontFamily: 'Syne_700Bold',
    },
    message: {
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 32,
        maxWidth: 400,
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#ef4444',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default ErrorBoundary;
