export const Theme = {
    colors: {
        background: '#050810',
        primary: '#22D3EE', // Cyan-400
        secondary: '#34D399', // Emerald-400
        positive: '#10B981',
        warning: '#F59E0B',
        critical: '#EF4444',
        border: '#1E293B',
        black: '#000000',
        white: '#FFFFFF',
    },
    fonts: {
        heading: 'Syne_800ExtraBold',
        headingSemi: 'Syne_700Bold',
        label: 'SpaceMono_400Regular',
        body: 'DMSans_400Regular',
    }
};

export const GlobalStyles = {
    screen: {
        flex: 1,
        backgroundColor: '#080808',
    },
    heading: {
        fontFamily: Theme.fonts.heading,
        color: '#FFFFFF',
    },
    label: {
        fontFamily: Theme.fonts.label,
        color: '#555555',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    body: {
        fontFamily: Theme.fonts.body,
        color: '#FFFFFF',
    },
    sharpBorder: {
        borderWidth: 1,
        borderColor: '#FFFFFF',
        borderRadius: 0,
    },
    glass: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    shadow: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    }
};
