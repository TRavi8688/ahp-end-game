import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles } from '../theme';

export default function ClinicalTimelineScreen({ navigation }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTimeline = async () => {
        try {
            const data = await ApiService.getTimeline();
            setEvents(data);
        } catch (error) {
            console.error('Error fetching clinical timeline:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchTimeline();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchTimeline();
    };

    const getEventIcon = (type) => {
        switch (type) {
            case 'PRESCRIPTION_CREATED': return { icon: 'medical', color: '#7c3aed' };
            case 'PRESCRIPTION_FULFILLED': return { icon: 'checkmark-circle', color: '#10b981' };
            case 'LAB_ORDER_CREATED': return { icon: 'flask', color: '#f59e0b' };
            case 'LAB_STATUS_UPDATED': return { icon: 'pulse', color: '#3b82f6' };
            default: return { icon: 'document-text', color: '#64748b' };
        }
    };

    const renderEventItem = ({ item, index }) => {
        const { icon, color } = getEventIcon(item.type);
        const isLast = index === events.length - 1;

        return (
            <View style={styles.timelineItem}>
                <View style={styles.leftCol}>
                    <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                        <Ionicons name={icon} size={20} color={color} />
                    </View>
                    {!isLast && <View style={styles.connectorLine} />}
                </View>
                <View style={styles.rightCol}>
                    <Text style={styles.eventTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {new Date(item.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text style={styles.eventSummary}>{item.summary}</Text>
                    <View style={styles.eventFooter}>
                        <Text style={styles.footerText}>Ref: {item.aggregate_type.toUpperCase()} #{item.aggregate_id.slice(0, 8)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color="#4c1d95" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#4c1d95', '#7c3aed']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Clinical Journey</Text>
            </LinearGradient>

            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={renderEventItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4c1d95" />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyText}>The timeline is clear.</Text>
                        <Text style={styles.emptySub}>Your medical journey events will appear here.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 20,
    },
    timelineItem: {
        flexDirection: 'row',
        minHeight: 80,
    },
    leftCol: {
        alignItems: 'center',
        marginRight: 15,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    connectorLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
    },
    rightCol: {
        flex: 1,
        paddingBottom: 25,
    },
    eventTime: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    eventSummary: {
        fontSize: 15,
        color: '#1e293b',
        fontWeight: '600',
        lineHeight: 20,
        marginBottom: 6,
    },
    eventFooter: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    footerText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
    },
    emptyBox: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#64748b',
        marginTop: 15,
    },
    emptySub: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 5,
    }
});
