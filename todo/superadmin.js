document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // --- LÓGICA DEL TEMA ---
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
    applyTheme(localStorage.getItem('theme') || 'light');
    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });
    
    // --- SELECTORES DE ELEMENTOS ---
    const userTableBody = document.getElementById('user-table-body');
    const createUserForm = document.getElementById('create-user-form');
    const logoutBtn = document.getElementById('logout-btn');
    const passwordInput = document.getElementById('password');
    const generatePasswordBtn = document.getElementById('generate-password-btn');

    // Selectores del Modal
    const credentialsModal = document.getElementById('credentials-modal');
    const modalEmail = document.getElementById('modal-email');
    const modalPassword = document.getElementById('modal-password');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const sendEmailBtn = document.getElementById('send-email-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    // --- FUNCIÓN PARA GENERAR CONTRASEÑA SEGURA ---
    const generateSecurePassword = () => {
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%&*_+-=';
        const allChars = upper + lower + numbers + symbols;
        let passwordArray = [];
        
        passwordArray.push(upper[Math.floor(Math.random() * upper.length)]);
        passwordArray.push(lower[Math.floor(Math.random() * lower.length)]);
        passwordArray.push(numbers[Math.floor(Math.random() * numbers.length)]);
        passwordArray.push(symbols[Math.floor(Math.random() * symbols.length)]);
        
        for (let i = 4; i < 12; i++) {
            passwordArray.push(allChars[Math.floor(Math.random() * allChars.length)]);
        }
        
        // Mezclar el array para aleatorizar el orden de los caracteres
        for (let i = passwordArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
        }
        
        return passwordArray.join('');
    };

    // --- FUNCIÓN TOAST (Notificaciones) ---
    const showToast = (message, type = 'success') => {
        // ... (puedes copiar la función showToast de otros archivos JS, sin cambios)
    };

    // --- LÓGICA PRINCIPAL ---
    const loadUsers = async () => { /* ... (sin cambios) ... */ };

    // Asignar y generar contraseña
    generatePasswordBtn.addEventListener('click', () => {
        passwordInput.value = generateSecurePassword();
    });

    // Manejar creación de usuario
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        const role = document.getElementById('role').value;
        const activeUntil = document.getElementById('activeUntil').value;

        if (!password) {
            showToast('Por favor, genera una contraseña antes de crear el usuario.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role, activeUntil })
            });
            if (!response.ok) throw new Error((await response.json()).error);
            
            modalEmail.textContent = email;
            modalPassword.textContent = password;
            credentialsModal.classList.remove('hidden');
            feather.replace();

            createUserForm.reset();
            passwordInput.value = generateSecurePassword(); // Generar nueva para el siguiente
            loadUsers();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    // ... (El resto del archivo JS para el modal, eliminar, editar, etc. no necesita cambios)
    
    // --- CARGA INICIAL ---
    passwordInput.value = generateSecurePassword(); // **LA LÍNEA CORREGIDA**
    loadUsers();
});