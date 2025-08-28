// pagos.js

// 1. Configuración de Firebase (REEMPLAZA CON TUS CREDENCIALES)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// 2. Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const functions = firebase.functions();

// 3. Lógica del botón de pago
document.addEventListener('DOMContentLoaded', () => {
    const elegirPlanProBtn = document.getElementById('elegir-plan-pro');

    if (elegirPlanProBtn) {
        elegirPlanProBtn.addEventListener('click', async () => {
            const user = auth.currentUser;

            if (!user) {
                alert("Por favor, inicia sesión o crea una cuenta para poder comprar.");
                // Opcional: redirigir a la página de login
                // window.location.href = 'login.html'; 
                return;
            }

            elegirPlanProBtn.disabled = true;
            elegirPlanProBtn.textContent = "Procesando...";

            try {
                // Llamar a la Cloud Function para crear la transacción
                const crearTransaccion = functions.httpsCallable('crearTransaccion');
                const result = await crearTransaccion({
                    userId: user.uid,
                    userEmail: user.email,
                    amountInCents: 29900000, // $299.000 en centavos
                    plan: 'pro'
                });

                if (result.data && result.data.redirectUrl) {
                    // Redirigir al usuario a la pasarela de pagos
                    window.location.href = result.data.redirectUrl;
                } else {
                    console.error("Respuesta inesperada de la función:", result);
                    alert('Error al crear el enlace de pago.');
                    elegirPlanProBtn.disabled = false;
                    elegirPlanProBtn.textContent = "Elegir Plan";
                }
            } catch (error) {
                console.error("Error al llamar a la Cloud Function:", error);
                alert("No se pudo iniciar el proceso de pago. Inténtalo de nuevo más tarde.");
                elegirPlanProBtn.disabled = false;
                elegirPlanProBtn.textContent = "Elegir Plan";
            }
        });
    }
});