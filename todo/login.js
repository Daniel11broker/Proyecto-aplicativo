import { db } from './db.js';
import { translations } from './translations.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // --- LÓGICA DE INTERNACIONALIZACIÓN (I18N) ---
    const languageSelector = document.getElementById('language-selector');

    const setLanguage = (lang) => {
        const elements = document.querySelectorAll('[data-translate]');
        const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');

        elements.forEach(el => {
            const key = el.getAttribute('data-translate');
            el.textContent = translations[lang][key];
        });

        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            el.setAttribute('placeholder', translations[lang][key]);
        });
        
        document.documentElement.lang = lang;
        // Se usa 'lang' para ser consistente con la página principal
        localStorage.setItem('lang', lang);
        languageSelector.value = lang;
    };

    languageSelector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });

    // Se lee 'lang' para ser consistente con la página principal
    const savedLanguage = localStorage.getItem('lang') || 'es';
    setLanguage(savedLanguage);

    // --- LÓGICA PARA EL TEMA (CLARO/OSCURO) ---
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        feather.replace();
    };
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- LÓGICA DE AUTENTICACIÓN ---

    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const verifyPassword = async (password, storedHash) => {
        const hashedInput = await hashPassword(password);
        return hashedInput === storedHash;
    };
    
    await db.open();

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';
        
        const currentLang = localStorage.getItem('lang') || 'es';

        let user = await db.admins.where({ username }).first();
        
        if (!user) {
            user = await db.appUsers.where({ username }).first();
        }

        if (user && await verifyPassword(password, user.passwordHash)) {
            
            if (user.role !== 'superadmin' && user.status === 'Inactivo') {
                alert(translations[currentLang].inactiveAccountError);
                loginError.textContent = translations[currentLang].inactiveAccountShortError;
                return;
            }
            
            localStorage.setItem('loggedInUser', JSON.stringify({ 
                username: user.username, 
                role: user.role, 
                id: user.id,
                adminId: user.adminId || null
            }));
            
            if (user.role === 'superadmin') {
                window.location.href = './superadmin.html';
            } else if (user.role === 'admin') {
                window.location.href = './admins.html'; 
            } else {
                window.location.href = './plan_de_pago/inicio.html';
            }

        } else {
            loginError.textContent = translations[currentLang].wrongCredentialsError;
        }
    });
});