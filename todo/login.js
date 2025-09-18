import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // Lógica para el tema (claro/oscuro)
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        feather.replace(); // Vuelve a renderizar los iconos para el nuevo tema
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
    
    await db.open();

    // Lógica del Formulario de Login
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';

        // Paso 1: Intentar encontrar al usuario en la tabla de administradores/superadministradores
        let user = await db.admins.where({ username }).first();
        
        // Paso 2: Si no se encuentra, buscar en la tabla de usuarios de la aplicación (editar/lectura)
        if (!user) {
            user = await db.appUsers.where({ username }).first();
        }

        // Si se encontró un usuario y la contraseña es correcta
        if (user && await verifyPassword(password, user.passwordHash)) {
            
            // Verificación de cuenta activa para todos los roles (excepto superadmin)
            if (user.role !== 'superadmin' && user.status === 'Inactivo') {
                alert('Tu cuenta está desactivada. Por favor, contacta a tu administrador.');
                loginError.textContent = 'Cuenta inactiva.';
                return;
            }
            
            // Guardar los datos del usuario en la sesión del navegador
            localStorage.setItem('loggedInUser', JSON.stringify({ 
                username: user.username, 
                role: user.role, 
                id: user.id,
                adminId: user.adminId || null
            }));
            
            // --- REDIRECCIÓN CORRECTA Y DEFINITIVA ---
            if (user.role === 'superadmin') {
                window.location.href = './superadmin.html';
            } else if (user.role === 'admin') {
                // El 'admin' va a la interfaz para gestionar a sus usuarios
                window.location.href = './admins.html'; 
            } else {
                // Los usuarios 'editar' y 'lectura' van a la interfaz principal de la aplicación
                window.location.href = './plan_de_pago/inicio.html';
            }

        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos.';
        }
    });
});