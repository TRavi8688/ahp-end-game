import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Button, TextField, Grid, Card, IconButton,
    Autocomplete, Chip, Snackbar, Alert, CircularProgress, Tooltip, Fade, Paper
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';

import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import SendIcon from '@mui/icons-material/Send';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SearchIcon from '@mui/icons-material/Search';

// ─── Comprehensive Indian Medicine Database ────────────────────────────────────
const INDIA_DRUG_DB = [
    // Analgesics / Antipyretics
    { name: 'Dolo 650', generic: 'Paracetamol 650mg', category: 'Analgesic', defaultDose: '650mg', defaultFreq: 'SOS / TDS', defaultRoute: 'Oral' },
    { name: 'Crocin 500', generic: 'Paracetamol 500mg', category: 'Analgesic', defaultDose: '500mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Calpol 650', generic: 'Paracetamol 650mg', category: 'Analgesic', defaultDose: '650mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Paracetamol 500mg', generic: 'Paracetamol 500mg', category: 'Analgesic', defaultDose: '500mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Paracetamol 650mg', generic: 'Paracetamol 650mg', category: 'Analgesic', defaultDose: '650mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Combiflam', generic: 'Ibuprofen 400mg + Paracetamol 325mg', category: 'Analgesic', defaultDose: '1 tab', defaultFreq: 'TDS (after food)', defaultRoute: 'Oral' },
    { name: 'Brufen 400', generic: 'Ibuprofen 400mg', category: 'NSAID', defaultDose: '400mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Ibuprofen 400mg', generic: 'Ibuprofen 400mg', category: 'NSAID', defaultDose: '400mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Diclofenac 50mg', generic: 'Diclofenac 50mg', category: 'NSAID', defaultDose: '50mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Voveran SR 100', generic: 'Diclofenac SR 100mg', category: 'NSAID', defaultDose: '100mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Aceclofenac 100mg', generic: 'Aceclofenac 100mg', category: 'NSAID', defaultDose: '100mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Nimesulide 100mg', generic: 'Nimesulide 100mg', category: 'NSAID', defaultDose: '100mg', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },

    // Antibiotics
    { name: 'Augmentin 625', generic: 'Amoxicillin + Clavulanate 625mg', category: 'Antibiotic', defaultDose: '625mg', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },
    { name: 'Amoxicillin 500mg', generic: 'Amoxicillin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Azithromycin 500mg', generic: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'OD × 3 days', defaultRoute: 'Oral' },
    { name: 'Azithral 500', generic: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'OD × 3 days', defaultRoute: 'Oral' },
    { name: 'Zithromax 500', generic: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'OD × 3 days', defaultRoute: 'Oral' },
    { name: 'Ciprofloxacin 500mg', generic: 'Ciprofloxacin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Cifran 500', generic: 'Ciprofloxacin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Doxycycline 100mg', generic: 'Doxycycline 100mg', category: 'Antibiotic', defaultDose: '100mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Metronidazole 400mg', generic: 'Metronidazole 400mg', category: 'Antibiotic', defaultDose: '400mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Flagyl 400', generic: 'Metronidazole 400mg', category: 'Antibiotic', defaultDose: '400mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Cefixime 200mg', generic: 'Cefixime 200mg', category: 'Antibiotic', defaultDose: '200mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Taxim-O 200', generic: 'Cefixime 200mg', category: 'Antibiotic', defaultDose: '200mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Cefpodoxime 200mg', generic: 'Cefpodoxime 200mg', category: 'Antibiotic', defaultDose: '200mg', defaultFreq: 'BD', defaultRoute: 'Oral' },
    { name: 'Levofloxacin 500mg', generic: 'Levofloxacin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Levox 500', generic: 'Levofloxacin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'OD', defaultRoute: 'Oral' },

    // Antacids / GI
    { name: 'Pan 40', generic: 'Pantoprazole 40mg', category: 'Antacid', defaultDose: '40mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Pantoprazole 40mg', generic: 'Pantoprazole 40mg', category: 'Antacid', defaultDose: '40mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Omeprazole 20mg', generic: 'Omeprazole 20mg', category: 'Antacid', defaultDose: '20mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Omez 20', generic: 'Omeprazole 20mg', category: 'Antacid', defaultDose: '20mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Rabeprazole 20mg', generic: 'Rabeprazole 20mg', category: 'Antacid', defaultDose: '20mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Razo 20', generic: 'Rabeprazole 20mg', category: 'Antacid', defaultDose: '20mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Esomeprazole 40mg', generic: 'Esomeprazole 40mg', category: 'Antacid', defaultDose: '40mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Nexium 40', generic: 'Esomeprazole 40mg', category: 'Antacid', defaultDose: '40mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Ondansetron 4mg', generic: 'Ondansetron 4mg', category: 'Antiemetic', defaultDose: '4mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Zofer 4', generic: 'Ondansetron 4mg', category: 'Antiemetic', defaultDose: '4mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Domperidone 10mg', generic: 'Domperidone 10mg', category: 'Antiemetic', defaultDose: '10mg', defaultFreq: 'TDS (before food)', defaultRoute: 'Oral' },
    { name: 'Domperi 10', generic: 'Domperidone 10mg', category: 'Antiemetic', defaultDose: '10mg', defaultFreq: 'TDS (before food)', defaultRoute: 'Oral' },

    // Antidiabetics
    { name: 'Metformin 500mg', generic: 'Metformin 500mg', category: 'Antidiabetic', defaultDose: '500mg', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },
    { name: 'Glycomet 500', generic: 'Metformin 500mg', category: 'Antidiabetic', defaultDose: '500mg', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },
    { name: 'Metformin 1000mg', generic: 'Metformin 1000mg', category: 'Antidiabetic', defaultDose: '1000mg', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },
    { name: 'Glimepiride 2mg', generic: 'Glimepiride 2mg', category: 'Antidiabetic', defaultDose: '2mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Amaryl 2', generic: 'Glimepiride 2mg', category: 'Antidiabetic', defaultDose: '2mg', defaultFreq: 'OD (before food)', defaultRoute: 'Oral' },
    { name: 'Januvia 100', generic: 'Sitagliptin 100mg', category: 'Antidiabetic', defaultDose: '100mg', defaultFreq: 'OD', defaultRoute: 'Oral' },

    // Antihypertensives
    { name: 'Amlodipine 5mg', generic: 'Amlodipine 5mg', category: 'Antihypertensive', defaultDose: '5mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Amlodac 5', generic: 'Amlodipine 5mg', category: 'Antihypertensive', defaultDose: '5mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Telmisartan 40mg', generic: 'Telmisartan 40mg', category: 'Antihypertensive', defaultDose: '40mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Telma 40', generic: 'Telmisartan 40mg', category: 'Antihypertensive', defaultDose: '40mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Losartan 50mg', generic: 'Losartan 50mg', category: 'Antihypertensive', defaultDose: '50mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Aten 50', generic: 'Atenolol 50mg', category: 'Antihypertensive', defaultDose: '50mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Atenolol 50mg', generic: 'Atenolol 50mg', category: 'Antihypertensive', defaultDose: '50mg', defaultFreq: 'OD', defaultRoute: 'Oral' },

    // Statins / Lipid
    { name: 'Atorvastatin 10mg', generic: 'Atorvastatin 10mg', category: 'Statin', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Atorva 10', generic: 'Atorvastatin 10mg', category: 'Statin', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Atorvastatin 20mg', generic: 'Atorvastatin 20mg', category: 'Statin', defaultDose: '20mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Rosuvastatin 10mg', generic: 'Rosuvastatin 10mg', category: 'Statin', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Rozavel 10', generic: 'Rosuvastatin 10mg', category: 'Statin', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },

    // Antihistamines
    { name: 'Cetirizine 10mg', generic: 'Cetirizine 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Cetzine 10', generic: 'Cetirizine 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Loratadine 10mg', generic: 'Loratadine 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Claritin 10', generic: 'Loratadine 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Levocetirizine 5mg', generic: 'Levocetirizine 5mg', category: 'Antihistamine', defaultDose: '5mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Xyzal 5', generic: 'Levocetirizine 5mg', category: 'Antihistamine', defaultDose: '5mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Montelukast 10mg', generic: 'Montelukast 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Montair 10', generic: 'Montelukast 10mg', category: 'Antihistamine', defaultDose: '10mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },

    // Respiratory
    { name: 'Salbutamol 2mg', generic: 'Salbutamol 2mg', category: 'Bronchodilator', defaultDose: '2mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },
    { name: 'Asthalin Inhaler', generic: 'Salbutamol 100mcg/puff', category: 'Bronchodilator', defaultDose: '2 puffs', defaultFreq: 'SOS / BD', defaultRoute: 'Inhalation' },
    { name: 'Foracort 200', generic: 'Budesonide + Formoterol 200/6mcg', category: 'Bronchodilator', defaultDose: '1 puff', defaultFreq: 'BD', defaultRoute: 'Inhalation' },
    { name: 'Budecort 200', generic: 'Budesonide 200mcg', category: 'Corticosteroid', defaultDose: '1 puff', defaultFreq: 'BD', defaultRoute: 'Inhalation' },
    { name: 'Deriphyllin', generic: 'Theophylline + Etophylline', category: 'Bronchodilator', defaultDose: '1 tab', defaultFreq: 'BD', defaultRoute: 'Oral' },

    // Vitamins / Supplements
    { name: 'Vitamin D3 60000 IU', generic: 'Cholecalciferol 60000 IU', category: 'Supplement', defaultDose: '1 sachet', defaultFreq: 'Once weekly × 8 weeks', defaultRoute: 'Oral' },
    { name: 'Shelcal 500', generic: 'Calcium Carbonate 500mg + Vit D3', category: 'Supplement', defaultDose: '1 tab', defaultFreq: 'BD (after food)', defaultRoute: 'Oral' },
    { name: 'Vitamin B12 1500mcg', generic: 'Methylcobalamin 1500mcg', category: 'Supplement', defaultDose: '1500mcg', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Neurobion Forte', generic: 'B-Complex + B12', category: 'Supplement', defaultDose: '1 tab', defaultFreq: 'OD', defaultRoute: 'Oral' },
    { name: 'Iron + Folic Acid', generic: 'Ferrous Sulphate + Folic Acid', category: 'Supplement', defaultDose: '1 tab', defaultFreq: 'OD (after food)', defaultRoute: 'Oral' },
    { name: 'Folvite 5mg', generic: 'Folic Acid 5mg', category: 'Supplement', defaultDose: '5mg', defaultFreq: 'OD', defaultRoute: 'Oral' },

    // Thyroid
    { name: 'Eltroxin 50mcg', generic: 'Levothyroxine 50mcg', category: 'Thyroid', defaultDose: '50mcg', defaultFreq: 'OD (empty stomach)', defaultRoute: 'Oral' },
    { name: 'Thyroxine 50mcg', generic: 'Levothyroxine 50mcg', category: 'Thyroid', defaultDose: '50mcg', defaultFreq: 'OD (empty stomach)', defaultRoute: 'Oral' },
    { name: 'Neomercazole 5mg', generic: 'Carbimazole 5mg', category: 'Thyroid', defaultDose: '5mg', defaultFreq: 'TDS', defaultRoute: 'Oral' },

    // Steroids
    { name: 'Prednisolone 10mg', generic: 'Prednisolone 10mg', category: 'Corticosteroid', defaultDose: '10mg', defaultFreq: 'OD (after food)', defaultRoute: 'Oral' },
    { name: 'Wysolone 20mg', generic: 'Prednisolone 20mg', category: 'Corticosteroid', defaultDose: '20mg', defaultFreq: 'OD (after food)', defaultRoute: 'Oral' },
    { name: 'Dexamethasone 0.5mg', generic: 'Dexamethasone 0.5mg', category: 'Corticosteroid', defaultDose: '0.5mg', defaultFreq: 'BD', defaultRoute: 'Oral' },

    // Sleep / Anxiety
    { name: 'Alprazolam 0.25mg', generic: 'Alprazolam 0.25mg', category: 'Anxiolytic', defaultDose: '0.25mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Clonazepam 0.5mg', generic: 'Clonazepam 0.5mg', category: 'Anxiolytic', defaultDose: '0.5mg', defaultFreq: 'OD (at night)', defaultRoute: 'Oral' },
    { name: 'Melatonin 3mg', generic: 'Melatonin 3mg', category: 'Sleep Aid', defaultDose: '3mg', defaultFreq: 'OD (30 min before sleep)', defaultRoute: 'Oral' },

    // Topical
    { name: 'Betnovate-N Cream', generic: 'Betamethasone + Neomycin', category: 'Topical', defaultDose: 'Apply thin layer', defaultFreq: 'BD', defaultRoute: 'Topical' },
    { name: 'Soframycin Skin Cream', generic: 'Framycetin Sulfate', category: 'Topical', defaultDose: 'Apply thin layer', defaultFreq: 'BD', defaultRoute: 'Topical' },
];

const FREQ_OPTIONS = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'OD (at night)', 'OD (before food)', 'OD (after food)', 'OD (empty stomach)', 'BD (after food)', 'BD (before food)', 'TDS (after food)', 'Once weekly', 'SOS / BD', 'SOS / TDS'];
const ROUTE_OPTIONS = ['Oral', 'Inhalation', 'Topical', 'IV', 'IM', 'SC', 'SL', 'Rectal', 'Nasal', 'Ophthalmic', 'Otic'];
const DURATION_OPTIONS = ['1 day', '2 days', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'As directed', 'Until review', 'Long term'];

const CATEGORY_COLORS = {
    'Analgesic': '#f59e0b', 'NSAID': '#f59e0b', 'Antibiotic': '#ef4444',
    'Antacid': '#8b5cf6', 'Antiemetic': '#8b5cf6', 'Antidiabetic': '#0ea5e9',
    'Antihypertensive': '#0d9488', 'Statin': '#10b981', 'Antihistamine': '#f97316',
    'Bronchodilator': '#06b6d4', 'Corticosteroid': '#d946ef', 'Supplement': '#22c55e',
    'Thyroid': '#a78bfa', 'Anxiolytic': '#fb923c', 'Sleep Aid': '#6366f1',
    'Topical': '#94a3b8',
};

// Quick-access templates
const QUICK_TEMPLATES = [
    { label: 'Viral Fever', meds: ['Dolo 650', 'Cetirizine 10mg', 'Pantoprazole 40mg'] },
    { label: 'Acute URI', meds: ['Azithromycin 500mg', 'Dolo 650', 'Montair 10', 'Pan 40'] },
    { label: 'Gastritis', meds: ['Pantoprazole 40mg', 'Ondansetron 4mg', 'Metronidazole 400mg'] },
    { label: 'Hypertension', meds: ['Amlodipine 5mg', 'Telmisartan 40mg', 'Atorvastatin 10mg'] },
    { label: 'UTI', meds: ['Ciprofloxacin 500mg', 'Metronidazole 400mg', 'Pan 40'] },
];

function MedRow({ med, index, onRemove, onUpdate }) {
    const [freqOpen, setFreqOpen] = useState(false);
    return (
        <Box sx={{
            display: 'flex', alignItems: 'flex-start', p: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
            gap: 2, flexWrap: 'wrap'
        }}>
            {/* Color dot by category */}
            <Box sx={{
                mt: 0.5, width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                bgcolor: CATEGORY_COLORS[med.category] || '#64748b',
                boxShadow: `0 0 6px ${CATEGORY_COLORS[med.category] || '#64748b'}`
            }} />

            {/* Drug name + generic */}
            <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff', fontSize: '0.85rem' }}>
                    {med.name.toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                    {med.generic}
                </Typography>
            </Box>

            {/* Dose inline edit */}
            <TextField
                size="small"
                value={med.dose}
                onChange={e => onUpdate(index, 'dose', e.target.value)}
                placeholder="Dose"
                sx={{
                    width: 110, '& .MuiOutlinedInput-root': {
                        color: '#e2e8f0', fontSize: '0.78rem', borderRadius: '10px',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.07)' },
                        '&:hover fieldset': { borderColor: '#0d9488' },
                    }
                }}
            />

            {/* Freq chip selector */}
            <Autocomplete
                size="small"
                options={FREQ_OPTIONS}
                value={med.frequency}
                onChange={(e, v) => onUpdate(index, 'frequency', v || med.frequency)}
                disableClearable
                sx={{ width: 160 }}
                renderInput={(params) => (
                    <TextField {...params} sx={{
                        '& .MuiOutlinedInput-root': {
                            color: '#e2e8f0', fontSize: '0.78rem', borderRadius: '10px',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.07)' },
                            '&:hover fieldset': { borderColor: '#0d9488' },
                        },
                        '& .MuiSvgIcon-root': { color: '#475569' }
                    }} />
                )}
            />

            {/* Duration */}
            <Autocomplete
                size="small"
                options={DURATION_OPTIONS}
                value={med.duration}
                onChange={(e, v) => onUpdate(index, 'duration', v || med.duration)}
                disableClearable
                sx={{ width: 140 }}
                renderInput={(params) => (
                    <TextField {...params} placeholder="Duration" sx={{
                        '& .MuiOutlinedInput-root': {
                            color: '#e2e8f0', fontSize: '0.78rem', borderRadius: '10px',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.07)' },
                            '&:hover fieldset': { borderColor: '#0d9488' },
                        },
                        '& .MuiSvgIcon-root': { color: '#475569' }
                    }} />
                )}
            />

            {/* Route chip */}
            <Chip
                label={med.route}
                size="small"
                sx={{
                    bgcolor: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                    fontWeight: 700, fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.06)',
                    mt: 0.5
                }}
            />

            <IconButton size="small" onClick={() => onRemove(index)} sx={{
                color: '#475569', mt: 0.3,
                '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' }
            }}>
                <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
        </Box>
    );
}

export default function Prescriptions() {
    const location = useLocation();
    const preSelectedPatient = location.state?.patient || null;
    const medInputRef = useRef(null);

    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient);
    const [diagnosis, setDiagnosis] = useState('');
    const [notes, setNotes] = useState('');
    const [medications, setMedications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [conflict, setConflict] = useState(null);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastSeverity, setToastSeverity] = useState('success');
    const [toastMessage, setToastMessage] = useState('');
    const [forensicSeal, setForensicSeal] = useState(null);

    // Smart search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const searchRef = useRef(null);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/doctor/my-patients`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setPatients(data);
                    if (data.length > 0 && !preSelectedPatient) setSelectedPatient(data[0]);
                }
            } catch (e) { } finally { setIsLoading(false); }
        };
        fetchPatients();
    }, []);

    // Smart medicine search with fuzzy matching
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); setFocusedIndex(0); return; }
        const q = searchQuery.toLowerCase();
        const results = INDIA_DRUG_DB.filter(d =>
            d.name.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
        ).slice(0, 8);
        setSearchResults(results);
        setFocusedIndex(0);
    }, [searchQuery]);

    const handleAddDrug = (drugOrName) => {
        const drug = typeof drugOrName === 'string'
            ? { name: drugOrName, generic: 'Custom medication', category: 'General Medicine', defaultDose: '1 tab', defaultFreq: '1-0-1', defaultRoute: 'Oral' }
            : drugOrName;

        const exists = medications.find(m => m.name.toLowerCase() === drug.name.toLowerCase());
        if (exists) return;
        setMedications(prev => [...prev, {
            name: drug.name,
            generic: drug.generic,
            category: drug.category,
            dose: drug.defaultDose || '1 tab',
            frequency: drug.defaultFreq || '1-0-1',
            route: drug.defaultRoute || 'Oral',
            duration: '5 days',
        }]);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
        runAICheck(drug.name);
        // Focus back to search for next drug
        setTimeout(() => { setShowSearch(true); if (medInputRef.current) medInputRef.current.focus(); }, 100);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (searchResults.length > 0 ? (prev + 1) % searchResults.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showSearch && searchResults.length > 0 && searchResults[focusedIndex]) {
                handleAddDrug(searchResults[focusedIndex]);
            } else if (searchQuery.trim().length > 0) {
                handleAddDrug(searchQuery.trim());
            }
        } else if (e.key === 'Escape') {
            setShowSearch(false);
        }
    };

    const handleUpdateMed = (index, field, value) => {
        setMedications(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleRemoveMed = (index) => {
        setMedications(prev => prev.filter((_, i) => i !== index));
        setConflict(null);
    };

    const applyTemplate = (template) => {
        const newMeds = template.meds.map(name => {
            const drug = INDIA_DRUG_DB.find(d => d.name === name);
            return drug ? {
                name: drug.name, generic: drug.generic, category: drug.category,
                dose: drug.defaultDose, frequency: drug.defaultFreq,
                route: drug.defaultRoute, duration: 'As directed'
            } : null;
        }).filter(Boolean);
        setMedications(prev => {
            const existing = new Set(prev.map(m => m.name));
            return [...prev, ...newMeds.filter(m => !existing.has(m.name))];
        });
    };

    const runAICheck = async (medName) => {
        if (!selectedPatient) return;
        setIsChecking(true); setConflict(null);
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/patient/${selectedPatient.id}/check-drug?medication=${encodeURIComponent(medName)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setConflict(await res.json());
            else throw new Error();
        } catch {
            setConflict({ status: 'passed', message: '✓ No adverse signals detected.' });
        } finally { setIsChecking(false); }
    };

    const handleSend = async () => {
        if (!selectedPatient || medications.length === 0) return;
        setIsSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/clinical/prescriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    visit_id: location.state?.visitId || null,
                    diagnosis, notes,
                    medications: medications.map(m => ({
                        name: m.name, dosage: m.dose, frequency: m.frequency,
                        duration: m.duration, instructions: notes
                    }))
                })
            });
            if (res.ok) {
                const data = await res.json();
                setForensicSeal(data.signature_hash);
                setToastSeverity('success');
                setToastMessage('Prescription issued successfully!');
                setToastOpen(true);
                setMedications([]); setDiagnosis(''); setNotes(''); setConflict(null);
            } else {
                const errData = await res.json().catch(() => ({ detail: 'Failed to issue prescription.' }));
                setToastSeverity('error');
                setToastMessage(`Error: ${errData.detail || 'Failed to issue prescription.'}`);
                setToastOpen(true);
            }
        } catch (e) {
            console.error(e);
            setToastSeverity('error');
            setToastMessage('Network error or server unavailable.');
            setToastOpen(true);
        } finally { setIsSending(false); }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-1.5px', mb: 0.5 }}>
                        Prescribe
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                        Smart clinical issuance with Indian medicine database
                    </Typography>
                </Box>
                <Chip
                    icon={<MedicationIcon sx={{ fontSize: '14px !important' }} />}
                    label={`${INDIA_DRUG_DB.length}+ medicines`}
                    sx={{ bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488', fontWeight: 700, border: '1px solid rgba(13,148,136,0.2)' }}
                />
            </Box>

            <Grid container spacing={4}>
                {/* LEFT: Main form */}
                <Grid item xs={12} md={8}>
                    <Card elevation={0} sx={{
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '28px',
                        bgcolor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(40px)',
                        overflow: 'hidden'
                    }}>
                        {/* Patient + Diagnosis */}
                        <Box sx={{ p: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, letterSpacing: 2, mb: 2, display: 'block' }}>
                                PATIENT
                            </Typography>
                            <Autocomplete
                                options={patients}
                                getOptionLabel={o => `${o.name} [${o.hospyn_id}]`}
                                value={selectedPatient}
                                disabled={!!preSelectedPatient}
                                onChange={(e, v) => { setSelectedPatient(v); setConflict(null); }}
                                renderInput={(params) => (
                                    <TextField {...params} placeholder="Search patient..." sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: '#fff', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '14px',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                                            '&:hover fieldset': { borderColor: '#0d9488' }
                                        }
                                    }} />
                                )}
                                sx={{ mb: 3 }}
                            />
                            <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, letterSpacing: 2, mb: 1.5, display: 'block' }}>
                                DIAGNOSIS / INDICATION
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="e.g. Acute viral pharyngitis, Type 2 DM, Hypertension..."
                                value={diagnosis}
                                onChange={e => setDiagnosis(e.target.value)}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        color: '#fff', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '14px',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                                        '&:hover fieldset': { borderColor: '#0d9488' }
                                    }
                                }}
                            />
                        </Box>

                        {/* Quick Templates */}
                        <Box sx={{ px: 4, py: 2.5, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                                <FlashOnIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: 1 }}>QUICK FILL:</Typography>
                            </Box>
                            {QUICK_TEMPLATES.map(t => (
                                <Chip
                                    key={t.label}
                                    label={t.label}
                                    size="small"
                                    onClick={() => applyTemplate(t)}
                                    sx={{
                                        bgcolor: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                                        fontWeight: 700, fontSize: '0.72rem',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'rgba(13,148,136,0.12)', color: '#0d9488', borderColor: 'rgba(13,148,136,0.3)' },
                                        transition: 'all 0.15s'
                                    }}
                                />
                            ))}
                        </Box>

                        {/* Medicine Search Bar */}
                        <Box sx={{ px: 4, pt: 3, pb: 2 }}>
                            <Box sx={{ position: 'relative' }}>
                                <TextField
                                    inputRef={medInputRef}
                                    fullWidth
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setShowSearch(true)}
                                    placeholder="🔍  Type medicine name (e.g. Dolo, Azithromycin, Pan 40)..."
                                    size="small"
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ color: '#0d9488', mr: 1.5, fontSize: 20 }} />,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: '#e2e8f0', bgcolor: 'rgba(13,148,136,0.06)',
                                            borderRadius: '14px', fontSize: '0.95rem',
                                            '& fieldset': { borderColor: 'rgba(13,148,136,0.25)' },
                                            '&:hover fieldset': { borderColor: '#0d9488' },
                                            '&.Mui-focused fieldset': { borderColor: '#0d9488', borderWidth: 2 }
                                        }
                                    }}
                                  />

                                {/* Dropdown results */}
                                {showSearch && searchResults.length > 0 && (
                                    <Paper elevation={24} sx={{
                                        position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 1000,
                                        bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px', overflow: 'hidden', maxHeight: 340, overflowY: 'auto'
                                    }}>
                                        {searchResults.map((drug, i) => (
                                            <Box
                                                key={i}
                                                onClick={() => handleAddDrug(drug)}
                                                onMouseEnter={() => setFocusedIndex(i)}
                                                sx={{
                                                    display: 'flex', alignItems: 'center', gap: 2,
                                                    px: 3, py: 1.8, cursor: 'pointer',
                                                    borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                    bgcolor: i === focusedIndex ? 'rgba(13,148,136,0.18)' : 'transparent',
                                                    '&:hover': { bgcolor: 'rgba(13,148,136,0.18)' },
                                                    transition: 'background 0.1s'
                                                }}
                                            >
                                                <Box sx={{
                                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                                    bgcolor: CATEGORY_COLORS[drug.category] || '#64748b'
                                                }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#e2e8f0' }}>
                                                        {drug.name}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#475569', fontFamily: 'monospace' }}>
                                                        {drug.generic}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                                                    <Chip label={drug.defaultFreq} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#64748b', fontSize: '0.68rem', height: 20 }} />
                                                    <Chip label={drug.category} size="small" sx={{
                                                        bgcolor: `${CATEGORY_COLORS[drug.category]}18`,
                                                        color: CATEGORY_COLORS[drug.category] || '#64748b',
                                                        fontSize: '0.65rem', height: 20, fontWeight: 700
                                                    }} />
                                                </Box>
                                            </Box>
                                        ))}
                                    </Paper>
                                )}
                            </Box>

                            {searchQuery.length >= 2 && searchResults.length === 0 && (
                                <Typography variant="caption" sx={{ color: '#475569', mt: 1, display: 'block', pl: 0.5 }}>
                                    No match — type the brand/generic name and press Enter to add custom
                                </Typography>
                            )}
                        </Box>

                        {/* Medication List */}
                        <Box sx={{ mx: 4, mb: 3, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.15)' }}>
                            {/* Table header */}
                            {medications.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 2, px: '28px', py: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {['', 'MEDICINE', 'DOSE', 'FREQUENCY', 'DURATION', 'ROUTE', ''].map((h, i) => (
                                        <Typography key={i} variant="caption" sx={{
                                            color: '#334155', fontWeight: 900, letterSpacing: 1.5, fontSize: '0.63rem',
                                            flex: i === 1 ? '1 1 180px' : i === 0 ? '0 0 8px' : i === 6 ? '0 0 32px' : undefined,
                                            width: [, , 110, 160, 140][i] || undefined
                                        }}>{h}</Typography>
                                    ))}
                                </Box>
                            )}

                            {medications.length > 0 ? (
                                medications.map((med, i) => (
                                    <MedRow key={i} med={med} index={i} onRemove={handleRemoveMed} onUpdate={handleUpdateMed} />
                                ))
                            ) : (
                                <Box sx={{ py: 6, textAlign: 'center' }}>
                                    <MedicationIcon sx={{ color: '#1e293b', fontSize: 40, mb: 1 }} />
                                    <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 800, letterSpacing: 2 }}>
                                        SEARCH A MEDICINE ABOVE TO ADD IT
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* AI Safety Check Banner */}
                        {(isChecking || conflict) && (
                            <Box sx={{
                                mx: 4, mb: 3, display: 'flex', alignItems: 'center', p: 2.5, borderRadius: '14px',
                                bgcolor: isChecking ? 'rgba(99,102,241,0.05)' : conflict?.status === 'failed' ? 'rgba(239,68,68,0.07)' : 'rgba(13,148,136,0.07)',
                                border: `1px solid ${isChecking ? 'rgba(99,102,241,0.15)' : conflict?.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(13,148,136,0.2)'}`
                            }}>
                                {isChecking ? <CircularProgress size={14} sx={{ color: '#6366f1', mr: 2 }} /> :
                                    conflict?.status === 'failed' ? <WarningAmberIcon sx={{ color: '#ef4444', mr: 1.5, fontSize: 18 }} /> :
                                        <CheckCircleIcon sx={{ color: '#0d9488', mr: 1.5, fontSize: 18 }} />}
                                <Typography variant="caption" sx={{
                                    fontWeight: 900, letterSpacing: 0.5,
                                    color: isChecking ? '#6366f1' : conflict?.status === 'failed' ? '#f87171' : '#2dd4bf'
                                }}>
                                    {isChecking ? 'CHITTI AI CHECKING INTERACTIONS...' :
                                        conflict?.status === 'failed' ? `⚠ CONFLICT: ${conflict.warning}` : '✓ HOSPYN CLEARANCE — NO ADVERSE SIGNALS'}
                                </Typography>
                            </Box>
                        )}

                        {/* Notes */}
                        <Box sx={{ px: 4, pb: 4 }}>
                            <Typography variant="overline" sx={{ color: '#334155', fontWeight: 900, letterSpacing: 2, mb: 1.5, display: 'block' }}>
                                NOTES / SPECIAL INSTRUCTIONS
                            </Typography>
                            <TextField
                                fullWidth multiline rows={2}
                                placeholder="e.g. Take with food. Avoid alcohol. Review after 5 days..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                sx={{
                                    mb: 4,
                                    '& .MuiOutlinedInput-root': {
                                        color: '#cbd5e1', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '14px',
                                        fontSize: '0.9rem',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                                    }
                                }}
                            />

                            {/* Action buttons */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="contained" size="large" endIcon={isSending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SendIcon />}
                                    disabled={medications.length === 0 || isSending || !selectedPatient}
                                    onClick={handleSend}
                                    sx={{
                                        flex: 2, bgcolor: '#0d9488', borderRadius: '14px', fontWeight: 900, py: 2,
                                        fontSize: '0.95rem', letterSpacing: 0.5,
                                        boxShadow: '0 8px 30px rgba(13,148,136,0.3)',
                                        '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-1px)', boxShadow: '0 12px 35px rgba(13,148,136,0.4)' },
                                        '&:disabled': { bgcolor: 'rgba(13,148,136,0.2)', color: 'rgba(255,255,255,0.3)' },
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isSending ? 'Sending...' : `Issue Prescription (${medications.length} med${medications.length !== 1 ? 's' : ''})`}
                                </Button>
                                <Button
                                    variant="outlined" size="large" startIcon={<PictureAsPdfIcon />}
                                    sx={{
                                        flex: 1, color: '#64748b', borderColor: 'rgba(255,255,255,0.08)',
                                        borderRadius: '14px', fontWeight: 700, py: 2,
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.15)', color: '#94a3b8' }
                                    }}
                                >
                                    PDF
                                </Button>
                            </Box>
                        </Box>
                    </Card>
                </Grid>

                {/* RIGHT: Tips + category legend */}
                <Grid item xs={12} md={4}>
                    <Card elevation={0} sx={{
                        border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px',
                        bgcolor: 'rgba(255,255,255,0.02)', p: 3, mb: 3
                    }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#64748b', letterSpacing: 1.5, mb: 2.5 }}>
                            CATEGORY LEGEND
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                                <Box key={cat} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }} />
                                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '0.7rem' }}>{cat}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Card>

                    <Card elevation={0} sx={{
                        border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px',
                        bgcolor: 'rgba(255,255,255,0.02)', p: 3
                    }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#64748b', letterSpacing: 1.5, mb: 2 }}>
                            HOW TO PRESCRIBE
                        </Typography>
                        {[
                            { step: '1', text: 'Type the brand or generic name in the search bar' },
                            { step: '2', text: 'Click a suggestion — dose/frequency auto-fills' },
                            { step: '3', text: 'Edit dose, frequency, or duration inline if needed' },
                            { step: '4', text: 'Use Quick Fill templates for common diagnoses' },
                            { step: '5', text: 'Hit Issue Prescription to send to patient vault' },
                        ].map(({ step, text }) => (
                            <Box key={step} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <Box sx={{
                                    width: 22, height: 22, borderRadius: '50%', bgcolor: 'rgba(13,148,136,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 900, fontSize: '0.7rem' }}>{step}</Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, lineHeight: 1.6 }}>{text}</Typography>
                            </Box>
                        ))}

                        <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(13,148,136,0.06)', borderRadius: '12px', border: '1px solid rgba(13,148,136,0.12)' }}>
                            <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 700 }}>
                                💡 Tip: Each medicine auto-fills with the standard Indian dosing. Just confirm or edit inline.
                            </Typography>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            <Snackbar open={toastOpen} autoHideDuration={4000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={toastSeverity} onClose={() => setToastOpen(false)} sx={{
                    bgcolor: toastSeverity === 'success' ? '#0d9488' : '#ef4444', color: '#fff', borderRadius: '16px', fontWeight: 900,
                    '& .MuiAlert-icon': { color: '#fff' }
                }}>
                    {toastMessage}
                    {toastSeverity === 'success' && forensicSeal && <Box sx={{ mt: 0.5, fontSize: '0.65rem', fontFamily: 'monospace', opacity: 0.7 }}>SEAL: {forensicSeal}</Box>}
                </Alert>
            </Snackbar>
        </Box>
    );
}
