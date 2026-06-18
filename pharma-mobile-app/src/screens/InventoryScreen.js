import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Theme, GlobalStyles } from '../theme/Theme';
import ApiService from '../utils/ApiService';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function InventoryScreen() {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);

    // Fast Entry State
    const [showFastEntry, setShowFastEntry] = useState(false);
    const [scannedItem, setScannedItem] = useState('');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');

    const loadInventory = async () => {
        setLoading(true);
        try {
            const res = await ApiService.get('/pharmacy/inventory');
            setInventory(res.data);
        } catch (error) {
            console.error('Failed to load inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    const handleCameraPress = async () => {
        if (!permission?.granted) await requestPermission();
        setShowScanner(true);
    };

    const handleTakePicture = async () => {
        if (!cameraRef.current) return;
        setIsScanning(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3 });
            setShowScanner(false);
            
            // Mocking fast scan logic for speed
            // In reality, this would hit /pharmacy/ai-scan
            setTimeout(() => {
                setScannedItem('Amoxicillin 500mg');
                setQty('50');
                setPrice('120');
                setIsScanning(false);
                setShowFastEntry(true);
            }, 800);
            
        } catch (error) {
            console.error('Scan Error:', error);
            Alert.alert('Error', 'Failed to scan.');
            setShowScanner(false);
            setIsScanning(false);
        }
    };

    const handleSaveStock = async () => {
        try {
            await ApiService.post('/pharmacy/inventory', {
                item_name: scannedItem || 'Manual Item',
                generic_name: 'Generic',
                batch_number: 'B-' + Math.floor(Math.random()*10000),
                expiry_date: '2027-12-31',
                unit_price: parseFloat(price) || 0,
                stock_quantity: parseInt(qty) || 0,
                reorder_level: 10,
                tax_percent: 5.0
            });
            setShowFastEntry(false);
            setScannedItem(''); setQty(''); setPrice('');
            loadInventory();
        } catch (error) {
            Alert.alert('Error', 'Failed to save item.');
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.genericName}>{item.generic_name || 'Generic'}</Text>
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 12 }}>
                    <View style={styles.miniBadge}>
                        <Text style={styles.detailText}>QTY: {item.stock_quantity}</Text>
                    </View>
                    <View style={[styles.miniBadge, {backgroundColor: 'rgba(59,130,246,0.1)'}]}>
                        <Text style={[styles.detailText, {color: Theme.colors.secondary}]}>MRP: ₹{item.unit_price}</Text>
                    </View>
                </View>
            </View>
            <View style={[styles.stockBadge, item.stock_quantity <= item.reorder_level && {backgroundColor: 'rgba(239,68,68,0.1)'}]}>
                <Text style={[styles.stockText, item.stock_quantity <= item.reorder_level && {color: Theme.colors.danger}]}>
                    {item.stock_quantity > item.reorder_level ? 'HEALTHY' : 'LOW'}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>HOSPYN INVENTORY</Text>
                    <Text style={styles.headerSub}>Stock Master</Text>
                </View>
                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => { setScannedItem(''); setShowFastEntry(true); }}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, {backgroundColor: Theme.colors.secondary}]} onPress={handleCameraPress}>
                        <Ionicons name="scan" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
            
            <FlatList
                data={inventory}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInventory} tintColor="#fff" />}
            />

            {/* AI Scanner Modal */}
            <Modal visible={showScanner} animationType="slide">
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef}>
                        <View style={styles.cameraOverlay}>
                            <TouchableOpacity style={styles.closeCamera} onPress={() => setShowScanner(false)}>
                                <Ionicons name="close-circle" size={40} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={styles.scanFrame} />
                            
                            <TouchableOpacity style={styles.captureBtn} onPress={handleTakePicture} disabled={isScanning}>
                                {isScanning ? <ActivityIndicator color="#fff" size="large" /> : <Ionicons name="scan-outline" size={40} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    </CameraView>
                </View>
            </Modal>

            {/* Fast Entry Modal */}
            <Modal visible={showFastEntry} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.fastEntryCard}>
                        <Text style={styles.modalTitle}>{scannedItem ? 'Scanned Item' : 'Manual Entry'}</Text>
                        
                        <TextInput 
                            style={styles.input} 
                            placeholder="Item Name" 
                            placeholderTextColor={Theme.colors.textMuted}
                            value={scannedItem}
                            onChangeText={setScannedItem}
                        />
                        <View style={{flexDirection: 'row', gap: 10}}>
                            <TextInput 
                                style={[styles.input, {flex: 1}]} 
                                placeholder="Qty" 
                                placeholderTextColor={Theme.colors.textMuted}
                                keyboardType="numeric"
                                value={qty}
                                onChangeText={setQty}
                            />
                            <TextInput 
                                style={[styles.input, {flex: 1}]} 
                                placeholder="Price (₹)" 
                                placeholderTextColor={Theme.colors.textMuted}
                                keyboardType="numeric"
                                value={price}
                                onChangeText={setPrice}
                            />
                        </View>

                        <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                            <TouchableOpacity style={[styles.btn, {backgroundColor: 'transparent', borderWidth: 1, borderColor: Theme.colors.border}]} onPress={() => setShowFastEntry(false)}>
                                <Text style={styles.btnText}>CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btn} onPress={handleSaveStock}>
                                <Text style={styles.btnText}>SAVE STOCK</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 10, color: Theme.colors.primary, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
    headerSub: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
    iconBtn: { backgroundColor: 'rgba(255,255,255,0.1)', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 24 },
    card: { backgroundColor: Theme.colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Theme.colors.border, flexDirection: 'row', alignItems: 'center' },
    itemName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    genericName: { color: Theme.colors.textMuted, fontSize: 12 },
    miniBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    detailText: { color: Theme.colors.primary, fontSize: 11, fontWeight: 'bold' },
    stockBadge: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    stockText: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    
    cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 40, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
    closeCamera: { alignSelf: 'flex-end', marginTop: 20 },
    scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: Theme.colors.secondary, borderRadius: 20 },
    captureBtn: { width: 80, height: 80, backgroundColor: Theme.colors.secondary, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 40, elevation: 10 },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    fastEntryCard: { backgroundColor: Theme.colors.surfaceLight, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: Theme.colors.border },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
    input: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: Theme.colors.border },
    btn: { flex: 1, backgroundColor: Theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 }
});
