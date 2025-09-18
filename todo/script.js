document.addEventListener('DOMContentLoaded', async () => {
    // Es importante llamar a feather.replace() después de cada cambio de contenido
    const updateIconsAndContent = () => {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            // Usamos i18next.t para obtener la traducción.
            // El segundo argumento es para interpolación, aquí pasamos un objeto con valores por defecto para las etiquetas <i>
            el.innerHTML = i18next.t(key, {
                interpolation: {
                    prefix: '((',
                    suffix: '))'
                }
            });
        });
        document.title = i18next.t('page.title');
        feather.replace(); // Vuelve a renderizar los iconos de Feather
    };

    // --- Lógica de Internacionalización (i18n) ---
    await i18next
        .use(i18nextHttpBackend)
        .init({
            lng: localStorage.getItem('lang') || 'es', // Usa el idioma guardado o 'es' por defecto
            fallbackLng: 'es',
            backend: {
                loadPath: './locales/{{lng}}.json', // Ruta a tus archivos de traducción
            },
            interpolation: {
                escapeValue: false, 
            }
        });

    updateIconsAndContent(); // Traduce la página por primera vez

    // Lógica del selector de idioma
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        languageSwitcher.value = i18next.language;
        languageSwitcher.addEventListener('change', (e) => {
            const newLang = e.target.value;
            i18next.changeLanguage(newLang, () => {
                updateIconsAndContent();
                localStorage.setItem('lang', newLang); // Guarda el idioma seleccionado
            });
        });
    }


    // --- Lógica del Tema (Claro/Oscuro) ---
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
        feather.replace();
    });

    // --- Lógica del Menú Móvil ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.querySelector('header nav');
    const mobileMenuLinks = mobileMenu.querySelectorAll('a');

    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });

    // --- Lógica de Scroll Suave ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            if(targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Lógica de Animaciones al hacer Scroll ---
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, {
        threshold: 0.1
    });

    animatedElements.forEach(el => observer.observe(el));
});