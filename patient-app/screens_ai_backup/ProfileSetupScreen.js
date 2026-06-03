import { Theme, GlobalStyles } from '../theme';

export default function ProfileSetupScreen({ navigation, route }) {
    const [formData, setFormData] = useState({
        fullName: '',
        age: '',
        gender: '',
        bloodGroup: ''
    });

    const handleNext = () => {
        navigation.navigate('MedicalHistory', { phone: route.params?.phone, ...formData });
    };

    return (
        <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <Text style={[styles.headerTitle, GlobalStyles.heading]}>Account Setup</Text>
                <Text style={styles.headerSubtitle}>Let's build your health profile</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.form}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. John Doe"
                        value={formData.fullName}
                        onChangeText={(v) => setFormData({ ...formData, fullName: v })}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Age</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Years"
                            keyboardType="number-pad"
                            value={formData.age}
                            onChangeText={(v) => setFormData({ ...formData, age: v })}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Gender</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="M/F/O"
                            value={formData.gender}
                            onChangeText={(v) => setFormData({ ...formData, gender: v })}
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Blood Group</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. O+ve"
                        value={formData.bloodGroup}
                        onChangeText={(v) => setFormData({ ...formData, bloodGroup: v })}
                    />
                </View>

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { padding: 40, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    headerSubtitle: { color: '#ddd', fontSize: 16, marginTop: 5 },
    form: { padding: 30 },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, color: '#4c1d95', fontWeight: 'bold', marginBottom: 8 },
    input: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 15, fontSize: 16 },
    row: { flexDirection: 'row' },
    button: {
        backgroundColor: '#4c1d95',
        height: 55,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
