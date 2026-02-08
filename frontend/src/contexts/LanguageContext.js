import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Basic detection or default to 'ko'
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem('mind_sync_language');
        return saved || 'ko';
    });

    useEffect(() => {
        localStorage.setItem('mind_sync_language', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'ko' ? 'en' : 'ko');
    };

    const t = (key, params = {}) => {
        let value = translations[language][key] || key;

        // If it's an array or object, return it directly
        if (typeof value !== 'string') {
            return value;
        }

        // Simple interpolation {key} for strings
        Object.keys(params).forEach(param => {
            value = value.replace(`{${param}}`, params[param]);
        });

        return value;
    };

    // For accessing word objects {ko:..., en:...}
    const getWord = (wordObj) => {
        if (!wordObj) return "";
        if (typeof wordObj === 'string') return wordObj; // Fallback for legacy string words
        return wordObj[language] || wordObj['ko'] || "";
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t, getWord }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
