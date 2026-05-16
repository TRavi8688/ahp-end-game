import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, 
    TouchableOpacity, ActivityIndicator, 
    RefreshControl, SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../utils/ApiService';
import { Theme } from '../theme';

const BillingScreen = ({ navigation }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInvoices = async () => {
        try {
            // Using the new patient-specific billing endpoint
            const data = await ApiService.get('/billing/my-invoices');
            setInvoices(data);
        } catch (err) {
            console.error("Billing Fetch Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchInvoices();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.heading}>MY BILLS</Text>
                    <Text style={styles.subheading}>Clinical financial ledger</Text>
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
            >
                {invoices.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="receipt-outline" size={48} color="#334155" />
                        </View>
                        <Text style={styles.emptyText}>No clinical receipts found yet.</Text>
                        <Text style={styles.emptySubtext}>Your invoices will appear here after your first consultation.</Text>
                    </View>
                ) : (
                    invoices.map((invoice) => (
                        <TouchableOpacity 
                            key={invoice.id} 
                            style={styles.invoiceCard}
                            onPress={() => navigation.navigate('InvoiceDetail', { invoice })}
                        >
                            <View style={styles.cardTop}>
                                <View>
                                    <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                                    <Text style={styles.invoiceDate}>{new Date(invoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                                <View style={[styles.statusBadge, { 
                                    backgroundColor: invoice.status === 'PAID' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    borderColor: invoice.status === 'PAID' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                                }]}>
                                    <Text style={[styles.statusText, { 
                                        color: invoice.status === 'PAID' ? Theme.colors.positive : Theme.colors.warning 
                                    }]}>{invoice.status}</Text>
                                </View>
                            </View>
                            
                            <View style={styles.cardBottom}>
                                <View>
                                    <Text style={styles.amountLabel}>NET PAYABLE</Text>
                                    <Text style={styles.amountValue}>₹{invoice.payable_amount.toLocaleString()}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#334155" />
                            </View>
                            
                            {invoice.paid_amount > 0 && invoice.status !== 'PAID' && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressLabelRow}>
                                        <Text style={styles.progressLabel}>Paid: ₹{invoice.paid_amount}</Text>
                                        <Text style={styles.progressLabel}>{Math.round((invoice.paid_amount / invoice.payable_amount) * 100)}%</Text>
                                    </View>
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressInner, { width: `${(invoice.paid_amount / invoice.payable_amount) * 100}%` }]} />
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    loadingContainer: { flex: 1, backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 24, flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
    backButton: { marginRight: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    heading: { fontFamily: Theme.fonts.heading, fontSize: 32, color: '#FFF', letterSpacing: -1 },
    subheading: { fontFamily: Theme.fonts.label, fontSize: 10, color: '#64748B', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
    scrollContent: { padding: 20, paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    emptyText: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 18, textAlign: 'center' },
    emptySubtext: { fontFamily: Theme.fonts.body, color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
    invoiceCard: { 
        backgroundColor: '#0F172A', 
        borderRadius: 28, 
        padding: 24, 
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    invoiceNumber: { fontFamily: Theme.fonts.label, color: Theme.colors.primary, fontSize: 14, fontWeight: '900' },
    invoiceDate: { fontFamily: Theme.fonts.body, color: '#475569', fontSize: 12, marginTop: 4 },
    statusBadge: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 0 },
    amountLabel: { fontFamily: Theme.fonts.label, color: '#475569', fontSize: 10, letterSpacing: 2 },
    amountValue: { fontFamily: Theme.fonts.headingSemi, color: '#FFF', fontSize: 32, marginTop: 4, letterSpacing: -1 },
    progressContainer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontFamily: Theme.fonts.label, color: '#64748B', fontSize: 9 },
    progressBar: { height: 6, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 3, overflow: 'hidden' },
    progressInner: { height: '100%', backgroundColor: Theme.colors.positive, borderRadius: 3 }
});

export default BillingScreen;
