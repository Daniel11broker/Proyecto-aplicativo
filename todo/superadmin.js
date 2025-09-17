// Archivo: superadmin.js

import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // Redirección si no está logeado o no es superadmin
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser || loggedInUser.role !== 'superadmin') {
        window.location.href = './login.html';
        return;
    }

    // Funciones de utilidad para el panel
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const renderAdmins = async () => {
        const admins = await db.admins.toArray();
        const tableBody = document.getElementById('admin-table-body');
        tableBody.innerHTML = admins.map(admin => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-6 py-4 font-medium">${admin.username}</td>
                <td class="px-6 py-4">${admin.role}</td>
                <td class="px-6 py-4 text-right flex justify-end gap-2">
                    <button onclick="editAdmin(${admin.id})" title="Editar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <i data-feather="edit" class="h-4 w-4 text-blue-600"></i>
                    </button>
                    <button onclick="deleteAdmin(${admin.id})" title="Eliminar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <i data-feather="trash-2" class="h-4 w-4 text-red-600"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        feather.replace();
    };

    // Funciones globales para manejar eventos desde el HTML
    window.editAdmin = async (id) => {
        const admin = await db.admins.get(id);
        if (admin) {
            document.getElementById('admin-id').value = admin.id;
            document.getElementById('username').value = admin.username;
            document.getElementById('role').value = admin.role;
            document.getElementById('password').removeAttribute('required'); // No se requiere contraseña para editar
            document.getElementById('password').value = '';
            document.getElementById('save-btn').textContent = 'Guardar Cambios';
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
        }
    };

    window.deleteAdmin = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este administrador?')) {
            const admin = await db.admins.get(id);
            if (admin.role === 'superadmin' && (await db.admins.where({ role: 'superadmin' }).count()) === 1) {
                alert('No puedes eliminar al único superadministrador.');
                return;
            }
            await db.admins.delete(id);
            await renderAdmins();
            alert('Administrador eliminado.');
        }
    };

    // Lógica del formulario
    const adminForm = document.getElementById('admin-form');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-id').value;
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;

        if (id) {
            // Editar administrador
            const updates = { username, role };
            if (password) {
                updates.passwordHash = await hashPassword(password);
            }
            await db.admins.update(parseInt(id), updates);
            alert('Administrador actualizado con éxito.');
        } else {
            // Crear nuevo administrador
            if (!password) {
                alert('La contraseña es requerida para crear un nuevo administrador.');
                return;
            }
            const passwordHash = await hashPassword(password);
            await db.admins.add({ username, passwordHash, role });
            alert('Administrador creado con éxito.');
        }

        // Limpiar formulario y restablecer estado
        adminForm.reset();
        document.getElementById('admin-id').value = '';
        document.getElementById('password').setAttribute('required', 'required');
        saveBtn.textContent = 'Crear Administrador';
        cancelBtn.classList.add('hidden');
        await renderAdmins();
    });

    cancelBtn.addEventListener('click', () => {
        adminForm.reset();
        document.getElementById('admin-id').value = '';
        document.getElementById('password').setAttribute('required', 'required');
        saveBtn.textContent = 'Crear Administrador';
        cancelBtn.classList.add('hidden');
    });

    // Renderizar la lista inicial al cargar
    await db.open();
    await renderAdmins();
});