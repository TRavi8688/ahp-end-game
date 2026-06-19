import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            "doc_login": "Doctor Login",
            "secure_access": "Secure access to the Hospyn Clinic Terminal.",
            "identifier_placeholder": "Mobile Number or Email Address",
            "pwd_placeholder": "Password or OTP",
            "hosp_code": "Hospital / Clinic Code",
            "hosp_helper": "Required only if accessing a shared institutional terminal",
            "login_btn": "Log In to Portal",
            "forgot_pwd": "Forgot Password?",
            "new_doc": "New Doctor? Verify",
            "built_for_clinicians": "Built for Clinicians",
            "built_desc": "One clean patient view. Avoid taking repetitive patient history. Instantly flag drug conflicts and summarize immense records with AI. Fully SOC2 compliant data storage protocols."
        }
    },
    hi: {
        translation: {
            "doc_login": "डॉक्टर लॉगिन",
            "secure_access": "Hospyn क्लिनिक टर्मिनल तक सुरक्षित पहुंच।",
            "identifier_placeholder": "मोबाइल नंबर या ईमेल पता",
            "pwd_placeholder": "पासवर्ड या OTP",
            "hosp_code": "अस्पताल / क्लिनिक कोड",
            "hosp_helper": "यदि साझा संस्थागत टर्मिनल तक पहुंच रहे हैं तभी आवश्यक है",
            "login_btn": "पोर्टल में लॉग इन करें",
            "forgot_pwd": "पासवर्ड भूल गए?",
            "new_doc": "नए डॉक्टर? सत्यापित करें",
            "built_for_clinicians": "चिकित्सकों के लिए निर्मित",
            "built_desc": "एक स्पष्ट रोगी दृश्य। दोहराए जाने वाले रोगी इतिहास से बचें। एआई के साथ दवा संघर्षों को तुरंत फ़्लैग करें और विशाल रिकॉर्ड को सारांशित करें।"
        }
    },
    te: {
        translation: {
            "doc_login": "డాక్టర్ లాగిన్",
            "secure_access": "Hospyn క్లినిక్ టెర్మినల్‌కు సురక్షిత ప్రాప్యత.",
            "identifier_placeholder": "మొబైల్ నంబర్ లేదా ఇమెయిల్ చిరునామా",
            "pwd_placeholder": "పాస్వర్డ్ లేదా OTP",
            "hosp_code": "ఆసుపత్రి / క్లినిక్ కోడ్",
            "hosp_helper": "భాగస్వామ్య సంస్థాగత టెర్మినల్‌కు ప్రాప్యత ఉంటే మాత్రమే అవసరం",
            "login_btn": "పోర్టల్‌లోకి లాగిన్ అవ్వండి",
            "forgot_pwd": "పాస్‌వర్డ్ మర్చిపోయారా?",
            "new_doc": "కొత్త డాక్టరా? ధృవీకరించండి",
            "built_for_clinicians": "వైద్యుల కోసం నిర్మించబడింది",
            "built_desc": "ఒక స్పష్టమైన రోగి వీక్షణ. పునరావృత రోగి చరిత్రను నివారించండి. AI తో డ్రగ్ విభేదాలను తక్షణమే ఫ్లాగ్ చేయండి మరియు అపారమైన రికార్డులను సంగ్రహించండి."
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: { escapeValue: false }
    });

export default i18n;
