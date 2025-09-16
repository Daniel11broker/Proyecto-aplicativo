document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // --- Lógica del Tema (Claro/Oscuro) ---
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        // Vuelve a cargar los íconos para que se ajusten al nuevo tema si es necesario
        feather.replace();
    };
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- Lógica del Formulario de Login ---
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        loginError.textContent = ''; // Limpiar errores previos

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Si la respuesta no es exitosa, lanza un error con el mensaje del servidor
                throw new Error(data.error || 'Ocurrió un error desconocido.');
            }

            // Si el login es exitoso, redirige según el rol
            if (data.role === 'superadmin') {
                window.location.href = '/superadmin.html';
            } else {
                // Para todos los demás roles (admin, cobranza, etc.)
                window.location.href = '/plan_de_pago/inicio.html';
            }

        } catch (error) {
            loginError.textContent = error.message;
        }
    });
});