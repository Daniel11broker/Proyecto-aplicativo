// Archivo: todo/admins.js
import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // --- LÓGICA DEL MENÚ, TEMA Y AUTENTICACIÓN (COMPLETA) ---
    const sidebar = document.getElementById('sidebar');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (window.innerWidth >= 768) {
        sidebar.addEventListener('mouseenter', () => sidebar.classList.add('expanded'));
        sidebar.addEventListener('mouseleave', () => sidebar.classList.remove('expanded'));
    }
    mobileMenuButton.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('expanded'); });
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && sidebar.classList.contains('expanded') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('expanded');
        }
    });

    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
    applyTheme(localStorage.getItem('theme') || 'light');
    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        window.location.href = './login.html';
    });

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser || (loggedInUser.role !== 'admin')) { // Solo admins
        window.location.href = './login.html';
        return;
    }

    // --- FUNCIONES DE LA APLICACIÓN ---
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
    
    // Nueva notificación mejorada
    const showNotification = (message, type = 'info') => {
        const colors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500',
        };
        const toastContainer = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `fixed top-20 right-5 ${colors[type]} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-pulse`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('animate-pulse');
            toast.style.transition = 'opacity 0.5s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    };

    const renderPage = async () => {
        // Renderizar la tabla de usuarios
        const users = await db.appUsers.where({ adminId: loggedInUser.id }).toArray();
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = users.map(user => {
            const statusColors = {
                'Activo': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                'Inactivo': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            };
            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-6 py-4 font-medium">${user.username}</td>
                <td class="px-6 py-4">${user.role}</td>
                <td class="px-6 py-4">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[user.status]}">
                        ${user.status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right flex justify-end gap-1">
                    <button onclick="window.editUser(${user.id})" title="Editar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="edit" class="h-4 w-4 text-blue-600"></i></button>
                    <button onclick="window.deleteUser(${user.id})" title="Eliminar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="trash-2" class="h-4 w-4 text-red-600"></i></button>
                </td>
            </tr>
        `}).join('');
        
        // **NUEVO: Renderizar el widget de límite de usuarios**
        const adminData = await db.admins.get(loggedInUser.id);
        const userLimit = adminData.userLimit || 5;
        const currentUserCount = users.length;
        document.getElementById('user-count-text').textContent = `${currentUserCount} / ${userLimit}`;
        
        feather.replace();
    };

    window.editUser = async (id) => {
        const user = await db.appUsers.get(id);
        if (user) {
            document.getElementById('user-id').value = user.id;
            document.getElementById('username').value = user.username;
            document.getElementById('role').value = user.role;
            document.getElementById('status').value = user.status || 'Activo';
            document.getElementById('password').removeAttribute('required');
            document.getElementById('password').value = '';
            document.getElementById('save-btn').textContent = 'Guardar Cambios';
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
        }
    };

    window.deleteUser = async (id) => {
        if (confirm('¿Estás seguro de eliminar este usuario?')) {
            await db.appUsers.delete(id);
            showNotification('Usuario eliminado correctamente.', 'success');
            await renderPage(); // Actualiza la tabla y el contador
        }
    };
    
    const userForm = document.getElementById('user-form');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        const status = document.getElementById('status').value;
        const adminId = loggedInUser.id;

        // **VERIFICACIÓN DE LÍMITE DE USUARIOS**
        if (!id) { // Solo al crear un nuevo usuario
            const adminData = await db.admins.get(adminId);
            const userLimit = adminData.userLimit || 5; // Límite por defecto si no está definido
            const currentUserCount = await db.appUsers.where({ adminId }).count();
            
            if (currentUserCount >= userLimit) {
                showNotification(`Has alcanzado el límite de ${userLimit} usuarios.`, 'error');
                return;
            }
        }

        const existingUser = await db.appUsers.where({ username }).first();
        if (existingUser && existingUser.id !== parseInt(id)) {
            showNotification('El nombre de usuario ya existe.', 'error');
            return;
        }

        if (id) {
            const updates = { username, role, status };
            if (password) {
                updates.passwordHash = await hashPassword(password);
            }
            await db.appUsers.update(parseInt(id), updates);
            showNotification('Usuario actualizado correctamente.', 'success');
        } else {
            if (!password) {
                showNotification('La contraseña es obligatoria para crear un nuevo usuario.', 'error');
                return;
            }
            const passwordHash = await hashPassword(password);
            await db.appUsers.add({ username, passwordHash, role, adminId, status });
            showNotification('Usuario creado con éxito.', 'success');
        }

        userForm.reset();
        document.getElementById('user-id').value = '';
        saveBtn.textContent = 'Crear Usuario';
        cancelBtn.classList.add('hidden');
        await renderPage(); // Actualiza la tabla y el contador
    });
    
    cancelBtn.addEventListener('click', () => {
        userForm.reset();
        document.getElementById('user-id').value = '';
        saveBtn.textContent = 'Crear Usuario';
        cancelBtn.classList.add('hidden');
    });
    
    await db.open();
    await renderPage();
});