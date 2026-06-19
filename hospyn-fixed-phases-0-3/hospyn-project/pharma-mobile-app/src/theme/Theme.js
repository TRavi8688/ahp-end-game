export const Theme = {
    colors: {
        background: '#020917', // Deep slate/charcoal
        surface: '#0A1128',
        surfaceLight: '#16203D',
        primary: '#10B981', // Emerald Green
        primaryDark: '#059669',
        secondary: '#3B82F6', // Hospyn Blue
        accent: '#06B6D4', // Soft Cyan
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        border: 'rgba(255,255,255,0.1)',
        danger: '#EF4444', // Minimal Red
        warning: '#F59E0B',
        success: '#10B981',
    }
};

export const GlobalStyles = {
    screen: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    heading: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    subHeading: {
        fontSize: 16,
        color: Theme.colors.textMuted,
        marginBottom: 20
    }
};
