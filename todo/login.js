import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // Lógica para el tema (claro/oscuro)
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

    // Función para generar un hash de contraseña
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    // Función para verificar la contraseña
    const verifyPassword = async (password, storedHash) => {
        const hashedInput = await hashPassword(password);
        return hashedInput === storedHash;
    };

    // Inicializar la base de datos y crear al superadministrador si no existe
    await db.open();

    const SUPERADMIN_USERNAME = 'Daniel11Broker';
    const SUPERADMIN_PASSWORD = '001614DaCr$';
    
    // Buscar si ya existe el superadmin
    const existingSuperadmin = await db.admins.where({ username: SUPERADMIN_USERNAME }).first();
    if (!existingSuperadmin) {
        const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);
        await db.admins.add({ username: SUPERADMIN_USERNAME, passwordHash, role: 'superadmin' });
        console.log('Superadministrador creado en la base de datos.');
    }

    // Lógica del Formulario de Login
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';

        const user = await db.admins.where({ username: username }).first();
        
        if (user && await verifyPassword(password, user.passwordHash)) {
            // Guardar el estado de la sesión
            localStorage.setItem('loggedInUser', JSON.stringify({ username: user.username, role: user.role }));
            
            if (user.role === 'superadmin') {
                window.location.href = './superadmin.html';
            } else {
                // Redireccionar a la página principal de administradores
                window.location.href = './plan_de_pago/inicio.html';
            }
        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos.';
        }
    });
});