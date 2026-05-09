import { Theme, GlobalStyles } from '../theme';

export default function RegistrationSuccessScreen({ navigation, route }) {
    const { hospyn_id, fullName } = route.params || { hospyn_id: 'Hospyn-IN-XXXX-XXXX-XX', fullName: 'Patient' };

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(hospyn_id);
    };

    const onShare = async () => {
        try {
            await Share.share({
                message: `My Mulajna Health Passport ID is ${hospyn_id}. Scan this to view my medical history.`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={80} color={Theme.colors.primary} />
                </View>
                <Text style={styles.welcomeText}>Welcome to Mulajna,</Text>
                <Text style={[styles.nameText, GlobalStyles.heading]}>{fullName}!</Text>
                <Text style={styles.subtitle}>Your AI Health Passport is ready.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={[styles.idCard, GlobalStyles.glass]}>
                    <Text style={styles.idLabel}>YOUR UNIQUE Hospyn ID</Text>
                    <View style={styles.idRow}>
                        <Text style={[styles.idValue, { color: '#fff' }]}>{hospyn_id}</Text>
                        <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
                            <Ionicons name="copy-outline" size={20} color={Theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.qrContainer}>
                        <View style={[styles.qrPlaceholder, { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <Ionicons name="qr-code-outline" size={120} color={Theme.colors.primary} />
                            <Text style={[styles.qrText, { color: Theme.colors.secondary }]}>Scan to Connect</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.benefitSection}>
                    <Text style={[styles.benefitTitle, { color: '#fff' }]}>What's Next?</Text>
                    <View style={styles.benefitItem}>
                        <Ionicons name="cloud-upload-outline" size={24} color={Theme.colors.primary} />
                        <Text style={[styles.benefitText, { color: '#94A3B8' }]}>Upload your medical reports for AI analysis.</Text>
                    </View>
                    <View style={styles.benefitItem}>
                        <Ionicons name="people-outline" size={24} color={Theme.colors.primary} />
                        <Text style={[styles.benefitText, { color: '#94A3B8' }]}>Share your Hospyn ID with doctors for instant consultation.</Text>
                    </View>
                </View>

                <TouchableOpacity style={[styles.mainButton, { backgroundColor: Theme.colors.primary }]} onPress={() => navigation.replace('MainTabs')}>
                    <Text style={styles.mainButtonText}>Go to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton} onPress={onShare}>
                    <Ionicons name="share-social-outline" size={20} color={Theme.colors.secondary} />
                    <Text style={[styles.shareButtonText, { color: Theme.colors.secondary }]}>Share Passport</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: {
        paddingTop: 80,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    successIcon: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '600' },
    nameText: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 5 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 10 },
    content: { padding: 25, flex: 1, justifyContent: 'space-between' },
    idCard: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 25,
        marginTop: -60,
        alignItems: 'center',
        elevation: 15,
        shadowColor: '#4c1d95',
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    idLabel: { color: '#6b7280', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
    idRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 15,
        marginTop: 15,
    },
    idValue: { fontSize: 22, fontWeight: '900', color: '#111827', marginRight: 15, letterSpacing: 1 },
    qrContainer: { marginTop: 25, alignItems: 'center' },
    qrPlaceholder: {
        width: 180,
        height: 180,
        backgroundColor: '#f5f3ff',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
    },
    qrText: { marginTop: 10, color: '#4c1d95', fontSize: 12, fontWeight: 'bold' },
    benefitSection: { marginTop: 20 },
    benefitTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
    benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 15 },
    benefitText: { fontSize: 14, color: '#4b5563', flex: 1, lineHeight: 20 },
    mainButton: {
        backgroundColor: '#4c1d95',
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    mainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    shareButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
    },
    shareButtonText: { color: '#4c1d95', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
});
