// Archivo: todo/superadmin.js
import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    // --- LÓGICA DEL MENÚ, TEMA Y AUTENTICACIÓN ---
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
    if (!loggedInUser || loggedInUser.role !== 'superadmin') {
        window.location.href = './login.html';
        return;
    }

    // --- SELECTORES GLOBALES ---
    const dom = {
        kpi: {
            total: document.getElementById('kpi-total-admins'),
            active: document.getElementById('kpi-active-admins'),
            inactive: document.getElementById('kpi-inactive-admins')
        },
        searchInput: document.getElementById('search-input'),
        addAdminBtn: document.getElementById('add-admin-btn'),
        tableBody: document.getElementById('admin-table-body'),
        modal: {
            el: document.getElementById('form-modal'),
            title: document.getElementById('modal-title'),
            form: document.getElementById('admin-form'),
            closeBtn: document.getElementById('close-modal-btn'),
            idInput: document.getElementById('admin-id'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            roleInput: document.getElementById('role'),
            statusInput: document.getElementById('status'),
            saveBtn: document.getElementById('save-btn'),
            cancelBtn: document.getElementById('cancel-edit-btn')
        },
        confirmModal: {
            el: document.getElementById('confirm-modal'),
            title: document.getElementById('confirm-title'),
            message: document.getElementById('confirm-message'),
            buttons: document.getElementById('confirm-buttons')
        },
        toastContainer: document.getElementById('toast-container')
    };

    // --- FUNCIONES DE LA APLICACIÓN ---
    const showToast = (message, type = 'success') => {
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? 'check-circle' : 'alert-triangle';
        const toast = document.createElement('div');
        toast.className = `toast ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg flex items-center gap-3`;
        toast.innerHTML = `<i data-feather="${icon}" class="h-5 w-5"></i><span>${message}</span>`;
        dom.toastContainer.appendChild(toast);
        feather.replace();
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 3000);
    };
    
    const showConfirmation = (title, message, onConfirm) => {
        dom.confirmModal.title.textContent = title;
        dom.confirmModal.message.textContent = message;
        dom.confirmModal.buttons.innerHTML = `<button id="confirm-cancel" class="bg-gray-300 dark:bg-gray-600 font-semibold py-2 px-4 rounded-lg">Cancelar</button><button id="confirm-ok" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg">Confirmar</button>`;
        dom.confirmModal.el.classList.remove('hidden');
        document.getElementById('confirm-ok').onclick = () => { onConfirm(); dom.confirmModal.el.classList.add('hidden'); };
        document.getElementById('confirm-cancel').onclick = () => dom.confirmModal.el.classList.add('hidden');
    };
    
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const renderPage = async () => {
        const searchTerm = dom.searchInput.value.toLowerCase();
        let admins = await db.admins.toArray();

        // Actualizar KPIs
        dom.kpi.total.textContent = admins.length;
        dom.kpi.active.textContent = admins.filter(a => a.status === 'Activo').length;
        dom.kpi.inactive.textContent = admins.filter(a => a.status === 'Inactivo').length;

        // Filtrar para la tabla
        if (searchTerm) {
            admins = admins.filter(admin => admin.username.toLowerCase().includes(searchTerm));
        }

        dom.tableBody.innerHTML = ''; // Limpiar tabla
        admins.forEach(admin => {
            const statusColors = {
                'Activo': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                'Inactivo': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            };
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
            row.innerHTML = `
                <td class="px-6 py-4 font-medium">${admin.username}</td>
                <td class="px-6 py-4">${admin.role}</td>
                <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[admin.status] || ''}">${admin.status}</span></td>
                <td class="px-6 py-4 text-right flex justify-end gap-1">
                    <button class="edit-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" data-id="${admin.id}" title="Editar"><i data-feather="edit" class="h-4 w-4 text-blue-600"></i></button>
                    <button class="delete-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" data-id="${admin.id}" title="Eliminar"><i data-feather="trash-2" class="h-4 w-4 text-red-600"></i></button>
                </td>`;
            dom.tableBody.appendChild(row);
        });
        feather.replace();
    };

    const openFormModal = (admin = null) => {
        dom.modal.form.reset();
        if (admin) {
            dom.modal.title.textContent = 'Editar Administrador';
            dom.modal.idInput.value = admin.id;
            dom.modal.usernameInput.value = admin.username;
            dom.modal.roleInput.value = admin.role;
            dom.modal.statusInput.value = admin.status;
            dom.modal.passwordInput.removeAttribute('required');
            dom.modal.saveBtn.textContent = 'Guardar Cambios';
            dom.modal.cancelBtn.classList.remove('hidden');
        } else {
            dom.modal.title.textContent = 'Crear Administrador';
            dom.modal.idInput.value = '';
            dom.modal.passwordInput.setAttribute('required', 'required');
            dom.modal.saveBtn.textContent = 'Crear';
            dom.modal.cancelBtn.classList.add('hidden');
        }
        dom.modal.el.classList.remove('hidden');
    };

    // --- EVENT LISTENERS ---
    dom.searchInput.addEventListener('input', renderPage);
    dom.addAdminBtn.addEventListener('click', () => openFormModal());
    dom.modal.closeBtn.addEventListener('click', () => dom.modal.el.classList.add('hidden'));
    dom.modal.cancelBtn.addEventListener('click', () => dom.modal.el.classList.add('hidden'));
    
    dom.tableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-btn');
        if (editButton) {
            const admin = await db.admins.get(parseInt(editButton.dataset.id));
            openFormModal(admin);
        }
        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton) {
            const adminId = parseInt(deleteButton.dataset.id);
            showConfirmation('Confirmar Eliminación', '¿Estás seguro? Esta acción no se puede deshacer.', async () => {
                await db.admins.delete(adminId);
                await db.paymentHistory.where({ adminId }).delete();
                showToast('Administrador eliminado.', 'success');
                await renderPage();
            });
        }
    });

    dom.modal.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = dom.modal.idInput.value;
        const username = dom.modal.usernameInput.value.trim();
        const password = dom.modal.passwordInput.value;
        const role = dom.modal.roleInput.value;
        const status = dom.modal.statusInput.value;
        
        const data = { username, role, status };

        if (id) { // Editando
            if (password) {
                data.passwordHash = await hashPassword(password);
            }
            await db.admins.update(parseInt(id), data);
            showToast('Administrador actualizado con éxito.', 'success');
        } else { // Creando
            if (!password) return alert('La contraseña es requerida para nuevos administradores.');
            data.passwordHash = await hashPassword(password);
            await db.admins.add(data);
            showToast('Administrador creado con éxito.', 'success');
        }
        
        dom.modal.el.classList.add('hidden');
        await renderPage();
    });

    // --- INICIALIZACIÓN ---
    await db.open();
    await renderPage();
});