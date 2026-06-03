import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';
import { Svg, Polyline, Circle, Line } from 'react-native-svg';

const { width } = Dimensions.get('window');
const chartHeight = 150;
const chartWidth = width - 60;

export default function WeeklyTrendsScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('BP');

    const tabs = ['BP', 'HEART', 'OXYGEN'];

    // Mock data for the chart
    const dataPoints = [80, 75, 78, 84, 82, 90, 84]; // Values from 0 to 100 for SVG
    const points = dataPoints.map((d, i) => `${(i * chartWidth) / 6},${chartHeight - (d * chartHeight) / 100}`).join(' ');

    return (
        <View style={GlobalStyles.screen}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.topBarLabel}>WEEKLY TRENDS</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Segmented Control */}
                <View style={styles.tabContainer}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Big Number */}
                <View style={styles.statsSection}>
                    <Text style={styles.bigValue}>{activeTab === 'BP' ? '128 / 84' : activeTab === 'HEART' ? '76' : '96%'}</Text>
                    <Text style={styles.statusText}>STABLE (+2% vs LAST WEEK)</Text>
                </View>

                {/* Chart Section */}
                <View style={styles.chartContainer}>
                    <Svg height={chartHeight + 40} width={chartWidth + 20}>
                        {/* Axes */}
                        <Line x1="10" y1="10" x2="10" y2={chartHeight + 10} stroke="#FFFFFF" strokeWidth="1" />
                        <Line x1="10" y1={chartHeight + 10} x2={chartWidth + 10} y2={chartHeight + 10} stroke="#FFFFFF" strokeWidth="1" />

                        {/* Line Plot */}
                        <Polyline
                            points={points.split(' ').map(p => {
                                const [x, y] = p.split(',');
                                return `${parseFloat(x) + 10},${parseFloat(y) + 10}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                        />

                        {/* Data Points */}
                        {dataPoints.map((d, i) => (
                            <Circle
                                key={i}
                                cx={(i * chartWidth) / 6 + 10}
                                cy={chartHeight - (d * chartHeight) / 100 + 10}
                                r="4"
                                fill="#FFFFFF"
                            />
                        ))}
                    </Svg>
                    {/* X-axis labels */}
                    <View style={styles.xAxis}>
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                            <Text key={day} style={styles.axisLabel}>{day}</Text>
                        ))}
                    </View>
                </View>

                {/* Insight Box */}
                <View style={styles.insightBox}>
                    <View style={styles.insightHeader}>
                        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                        <Text style={styles.insightTitle}>CHITTI INSIGHT</Text>
                    </View>
                    <Text style={styles.insightText}>
                        BP typically rises after 6 PM. Reduce evening sodium intake for better stability.
                    </Text>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        gap: 20,
        paddingBottom: 20,
    },
    topBarLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 12,
        letterSpacing: 2,
    },
    scrollContent: {
        paddingHorizontal: 30,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 0,
    },
    tab: {
        flex: 1,
        height: 45,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
    },
    tabText: {
        fontFamily: Theme.fonts.label,
        color: '#FFFFFF',
        fontSize: 12,
    },
    activeTabText: {
        color: '#000000',
    },
    statsSection: {
        marginTop: 50,
        marginBottom: 40,
    },
    bigValue: {
        fontFamily: Theme.fonts.heading,
        color: Theme.colors.primary,
        fontSize: 40,
    },
    statusText: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 12,
        marginTop: 5,
    },
    chartContainer: {
        marginTop: 20,
        paddingLeft: 10,
    },
    xAxis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        width: chartWidth,
        marginLeft: 10,
    },
    axisLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 8,
    },
    insightBox: {
        marginTop: 60,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#333333',
        padding: 20,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    insightTitle: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.primary,
        fontSize: 10,
        letterSpacing: 1,
    },
    insightText: {
        fontFamily: Theme.fonts.body,
        color: Theme.colors.primary,
        fontSize: 14,
        lineHeight: 20,
    }
});
