// ELIMINADO: Ya no se importa la base de datos local
// import { db } from './db.js';
import { translations } from './translations.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // --- LÓGICA DE INTERNACIONALIZACIÓN (I18N) (Sin cambios) ---
    const languageSelector = document.getElementById('language-selector');

    const setLanguage = (lang) => {
        const elements = document.querySelectorAll('[data-translate]');
        const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');

        elements.forEach(el => {
            const key = el.getAttribute('data-translate');
            if (translations[lang] && translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });

        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            if (translations[lang] && translations[lang][key]) {
                el.setAttribute('placeholder', translations[lang][key]);
            }
        });
        
        document.documentElement.lang = lang;
        localStorage.setItem('lang', lang);
        languageSelector.value = lang;
    };

    languageSelector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });

    const savedLanguage = localStorage.getItem('lang') || 'es';
    setLanguage(savedLanguage);

    // --- LÓGICA PARA EL TEMA (CLARO/OSCURO) (Sin cambios) ---
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

    // --- LÓGICA DE AUTENTICACIÓN (Modificada para usar API) ---

    // NUEVO: URL del servidor backend
    const API_URL = 'http://localhost:3000/api';

    // ELIMINADO: Las funciones hashPassword y verifyPassword ya no son necesarias en el cliente.
    // El backend se encarga de la verificación segura.

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';
        
        const currentLang = localStorage.getItem('lang') || 'es';

        try {
            // Se envía una petición POST al endpoint de login del servidor
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();

            if (response.ok) {
                // Si la respuesta es exitosa (código 200-299)
                const user = result.user;
                
                // Guardamos los datos del usuario logueado en localStorage
                localStorage.setItem('loggedInUser', JSON.stringify({ 
                    username: user.username, 
                    role: user.role, 
                    id: user.id,
                    adminId: user.adminId || null
                }));
                
                // Redirigimos según el rol del usuario
                if (user.role === 'superadmin') {
                    window.location.href = './superadmin.html';
                } else if (user.role === 'admin') {
                    window.location.href = './admins.html'; 
                } else {
                    window.location.href = './plan gratis/inicio.html';
                }

            } else {
                // Si hay un error (código 401, 403, 500, etc.)
                // Mostramos el mensaje de error que nos envía el servidor
                loginError.textContent = result.message || translations[currentLang].wrongCredentialsError;
            }
        } catch (error) {
            // Error de red (el servidor no está corriendo, etc.)
            console.error('Error de conexión:', error);
            loginError.textContent = 'No se pudo conectar al servidor. Inténtalo de nuevo más tarde.';
        }
    });
});