import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service like Sentry here
        console.error("Hospyn Error Boundary Caught:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '400px',
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '24px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    backdropFilter: 'blur(10px)',
                    m: 2
                }}>
                    <WarningAmberIcon sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'Outfit', mb: 1 }}>
                        System Module Offline
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 4, maxWidth: '400px' }}>
                        A critical exception occurred while rendering this module. Our telemetry systems have been notified. The rest of your session remains secure.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                            variant="contained" 
                            onClick={() => window.location.reload()}
                            sx={{ 
                                bgcolor: '#ef4444', 
                                '&:hover': { bgcolor: '#dc2626' },
                                fontWeight: 800,
                                borderRadius: '12px',
                                px: 4
                            }}
                        >
                            Reboot Module
                        </Button>
                        <Button 
                            variant="outlined" 
                            onClick={() => window.history.back()}
                            sx={{ 
                                color: '#fff',
                                borderColor: 'rgba(255,255,255,0.2)',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                                fontWeight: 800,
                                borderRadius: '12px',
                                px: 4
                            }}
                        >
                            Go Back
                        </Button>
                    </Box>

                    {this.state.error && (
                        <Box sx={{ mt: 4, p: 2, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '8px', textAlign: 'left', overflowX: 'auto', width: '100%', maxWidth: '800px' }}>
                            <Typography variant="caption" sx={{ color: '#ef4444', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {this.state.error.toString()}
                                {'\n\n'}
                                {this.state.errorInfo?.componentStack}
                            </Typography>
                        </Box>
                    )}
                </Box>
            );
        }

        return this.props.children; 
    }
}

export default ErrorBoundary;
