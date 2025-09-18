// Archivo: todo/pagos.js
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
    
    // --- LÓGICA DE LA PÁGINA DE PAGOS ---
    const tableBody = document.getElementById('payments-table-body');

    const renderPayments = async () => {
        await db.open();
        const admins = await db.admins.where('role').equals('admin').toArray();
        const payments = await db.paymentHistory.toArray();
        
        tableBody.innerHTML = '';

        if (admins.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">No hay administradores para gestionar.</td></tr>`;
            return;
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // Formato YYYY-MM

        admins.forEach(admin => {
            const lastPayment = payments
                .filter(p => p.adminId === admin.id)
                .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];

            const hasPaidThisMonth = lastPayment && lastPayment.paymentMonth === currentMonth;
            const paymentStatus = hasPaidThisMonth ? 'Pagado' : 'Atrasado';

            const paymentStatusColors = {
                'Pagado': 'bg-green-100 text-green-800',
                'Atrasado': 'bg-red-100 text-red-800',
            };
            const accountStatusColors = {
                'Activo': 'bg-green-100 text-green-800',
                'Inactivo': 'bg-gray-100 text-gray-800',
            };

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium">${admin.username}</td>
                <td class="px-6 py-4">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${paymentStatusColors[paymentStatus]}">
                        ${paymentStatus}
                    </span>
                </td>
                <td class="px-6 py-4">${lastPayment ? lastPayment.paymentDate : 'Nunca'}</td>
                <td class="px-6 py-4">
                     <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${accountStatusColors[admin.status]}">
                        ${admin.status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${!hasPaidThisMonth ? `<button data-id="${admin.id}" class="mark-paid-btn bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-full">Registrar Pago</button>` : `<span class="text-xs text-gray-500">Al día</span>`}
                </td>
            `;
            tableBody.appendChild(tr);
        });
        
        document.querySelectorAll('.mark-paid-btn').forEach(button => {
            button.addEventListener('click', handleMarkAsPaid);
        });
        feather.replace();
    };

    const handleMarkAsPaid = async (e) => {
        const adminId = parseInt(e.target.dataset.id);
        if (confirm('¿Confirmar que este administrador ha pagado la mensualidad? Esto activará su cuenta si está inactiva.')) {
            const today = new Date();
            const paymentDate = today.toISOString().slice(0, 10);
            const paymentMonth = today.toISOString().slice(0, 7);

            // Activar la cuenta del administrador
            await db.admins.update(adminId, { status: 'Activo' });
            
            // Registrar el pago en el historial
            await db.paymentHistory.add({
                adminId: adminId,
                paymentMonth: paymentMonth,
                paymentDate: paymentDate,
                amount: 299000, // Valor del plan
                status: 'Pagado'
            });
            
            alert('El pago ha sido registrado y la cuenta del administrador está activa.');
            await renderPayments();
        }
    };
    
    await renderPayments();
});