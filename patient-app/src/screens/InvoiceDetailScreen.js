import { 
    View, Text, StyleSheet, ScrollView, 
    TouchableOpacity, SafeAreaView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Theme } from '../theme';
import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';

const InvoiceDetailScreen = ({ route, navigation }) => {
    const { invoice } = route.params;
    const [isDownloading, setIsDownloading] = React.useState(false);

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            const token = await SecurityUtils.getToken();
            const fileUri = `${FileSystem.cacheDirectory}Invoice_${invoice.invoice_number}.pdf`;
            
            const downloadRes = await FileSystem.downloadAsync(
                `${API_BASE_URL}/billing/invoices/${invoice.id}/pdf`,
                fileUri,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (downloadRes.status === 200) {
                await Sharing.shareAsync(downloadRes.uri);
            } else {
                Alert.alert("Clinical Error", "The revenue engine could not generate your receipt at this time.");
            }
        } catch (error) {
            console.error("PDF_ERROR:", error);
            Alert.alert("Connectivity Error", "Could not reach the clinical server.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.heading}>RECEIPT</Text>
                    <Text style={styles.subheading}>{invoice.invoice_number}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Premium Summary Card */}
                <View style={[styles.summaryCard, { backgroundColor: invoice.status === 'PAID' ? Theme.colors.primary : '#1E293B' }]}>
                    <Text style={styles.totalLabel}>TOTAL PAYABLE</Text>
                    <Text style={styles.totalValue}>₹{invoice.payable_amount.toLocaleString()}</Text>
                    
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.gridLabel}>PAYMENT STATUS</Text>
                            <Text style={[styles.gridValue, { color: invoice.status === 'PAID' ? '#4ADE80' : Theme.colors.warning }]}>{invoice.status}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.gridLabel}>BILLING DATE</Text>
                            <Text style={styles.gridValue}>{new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
                        </View>
                    </View>
                </View>

                {/* Bill Items Section */}
                <Text style={styles.sectionTitle}>ITEMIZED CHARGES</Text>
                <View style={styles.itemsContainer}>
                    {invoice.items && invoice.items.length > 0 ? (
                        invoice.items.map((item, idx) => (
                            <View key={item.id || idx} style={[styles.itemRow, idx === invoice.items.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.item_name}</Text>
                                    <Text style={styles.itemCategory}>{item.item_category} • Qty: {item.quantity}</Text>
                                </View>
                                <Text style={styles.itemPrice}>₹{item.subtotal.toLocaleString()}</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.noItemsRow}>
                            <Text style={styles.noItemsText}>No items listed on this invoice.</Text>
                        </View>
                    )}
                </View>

                {/* Detailed Breakdown */}
                <View style={styles.breakdownContainer}>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Subtotal</Text>
                        <Text style={styles.breakdownValue}>₹{invoice.total_amount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>GST / Tax</Text>
                        <Text style={styles.breakdownValue}>₹{invoice.tax_amount.toLocaleString()}</Text>
                    </View>
                    {invoice.discount_amount > 0 && (
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: Theme.colors.critical }]}>Clinical Discount</Text>
                            <Text style={[styles.breakdownValue, { color: Theme.colors.critical }]}>- ₹{invoice.discount_amount.toLocaleString()}</Text>
                        </View>
                    )}
                    <View style={[styles.breakdownRow, styles.finalRow]}>
                        <Text style={styles.finalLabel}>Net Amount</Text>
                        <Text style={styles.finalValue}>₹{invoice.payable_amount.toLocaleString()}</Text>
                    </View>
                </View>
                
                {/* Action Buttons */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity 
                        style={[styles.downloadButton, isDownloading && { opacity: 0.7 }]}
                        onPress={handleDownload}
                        disabled={isDownloading}
                    >
                        {isDownloading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <>
                                <Ionicons name="download-outline" size={20} color="#FFF" />
                                <Text style={styles.downloadText}>DOWNLOAD OFFICIAL RECEIPT</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    
                    {invoice.status !== 'PAID' && (
                        <TouchableOpacity style={styles.payNowButton}>
                            <Text style={styles.payNowText}>PAY BALANCE NOW</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.footer}>
                    <Ionicons name="shield-checkmark" size={16} color="#1E293B" />
                    <Text style={styles.footerText}>SECURE CLINICAL TRANSACTION • HOSPYN CORE v2.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    header: { padding: 24, flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
    backButton: { marginRight: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    heading: { fontFamily: Theme.fonts.heading, fontSize: 32, color: '#FFF', letterSpacing: -1 },
    subheading: { fontFamily: Theme.fonts.label, fontSize: 10, color: '#64748B', marginTop: 4, letterSpacing: 1 },
    scrollContent: { padding: 20, paddingBottom: 60 },
    summaryCard: { borderRadius: 32, padding: 32, marginBottom: 40, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 30 },
    totalLabel: { fontFamily: Theme.fonts.label, color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 2 },
    totalValue: { fontFamily: Theme.fonts.heading, color: '#FFF', fontSize: 48, marginTop: 8, letterSpacing: -2 },
    summaryGrid: { flexDirection: 'row', marginTop: 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 24 },
    summaryItem: { flex: 1 },
    gridLabel: { fontFamily: Theme.fonts.label, color: 'rgba(255,255,255,0.5)', fontSize: 8, letterSpacing: 1 },
    gridValue: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 14, marginTop: 4 },
    sectionTitle: { fontFamily: Theme.fonts.label, color: '#475569', fontSize: 10, letterSpacing: 2, marginBottom: 16, marginLeft: 8 },
    itemsContainer: { backgroundColor: '#0F172A', borderRadius: 28, padding: 8, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    itemInfo: { flex: 1 },
    itemName: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 16 },
    itemCategory: { fontFamily: Theme.fonts.body, color: '#475569', fontSize: 12, marginTop: 4 },
    itemPrice: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 16 },
    noItemsRow: { padding: 30, alignItems: 'center' },
    noItemsText: { fontFamily: Theme.fonts.body, color: '#475569', fontSize: 14 },
    breakdownContainer: { padding: 20 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    breakdownLabel: { fontFamily: Theme.fonts.body, color: '#64748B', fontSize: 14 },
    breakdownValue: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 14 },
    finalRow: { marginTop: 12, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    finalLabel: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 20 },
    finalValue: { fontFamily: Theme.fonts.heading, color: '#FFF', fontSize: 28 },
    actionContainer: { marginTop: 40, gap: 12 },
    downloadButton: { backgroundColor: '#1E293B', padding: 24, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    downloadText: { fontFamily: Theme.fonts.label, color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    payNowButton: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, alignItems: 'center' },
    payNowText: { fontFamily: Theme.fonts.label, color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    footer: { marginTop: 60, alignItems: 'center', opacity: 0.3, flexDirection: 'row', justifyContent: 'center', gap: 8 },
    footerText: { fontFamily: Theme.fonts.label, color: '#FFF', fontSize: 8, letterSpacing: 1 }
});

export default InvoiceDetailScreen;
