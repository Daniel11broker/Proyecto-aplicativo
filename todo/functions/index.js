const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Wompi = require("wompi-node");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// IMPORTANTE: Configura tus claves de Wompi en Firebase usando la CLI
// firebase functions:config:set wompi.publickey="pub_xxxxxxxx" wompi.privatekey="prv_xxxxxxxx" wompi.webhooksecret="whs_xxxxxxxx"
const wompi = new Wompi({
  publicKey: functions.config().wompi.publickey,
  privateKey: functions.config().wompi.privatekey,
});

// FUNCIÓN 1: Crea la transacción de pago y devuelve la URL para redirigir al usuario.
exports.crearTransaccion = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario esté autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'El usuario debe estar autenticado para realizar un pago.');
  }

  const { userId, userEmail, amountInCents, plan } = data;
  const reference = `suite-${plan}-${userId}-${Date.now()}`;
  const redirectUrl = "https://TU_SITIO_WEB/pago-finalizado.html"; // URL a la que vuelve el usuario

  try {
    const transaction = await wompi.createTransaction({
      amount_in_cents: amountInCents,
      currency: "COP",
      customer_email: userEmail,
      reference: reference,
      redirect_url: redirectUrl,
    });

    // Guardar un registro de la transacción pendiente en Firestore
    await admin.firestore().collection('transacciones').doc(reference).set({
      userId: userId,
      status: 'PENDING',
      plan: plan,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      wompiId: transaction.id,
      amount: amountInCents / 100
    });

    return { redirectUrl: transaction.presigned_acceptance.permalink };

  } catch (error) {
    console.error("Error al crear transacción en Wompi:", error.message);
    throw new functions.https.HttpsError('internal', 'No se pudo crear el enlace de pago.');
  }
});

// FUNCIÓN 2: Webhook que escucha las notificaciones de Wompi para confirmar los pagos.
exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  const event = req.body;

  // IMPORTANTE: Verificar la firma del evento para seguridad (ver documentación de Wompi)
  // const signature = req.headers['x-wompi-signature'];
  // const calculatedSignature = ...;
  // if(signature !== calculatedSignature) { return res.status(401).send('Firma inválida.'); }

  if (event.event === 'transaction.updated') {
    const transactionData = event.data.transaction;
    const reference = transactionData.reference;
    const status = transactionData.status; // "APPROVED", "DECLINED", "VOIDED"

    const transactionRef = admin.firestore().collection('transacciones').doc(reference);

    if (status === 'APPROVED') {
      const transactionDoc = await transactionRef.get();
      if (transactionDoc.exists && transactionDoc.data().status !== 'APPROVED') {
        
        await transactionRef.update({ 
            status: 'APPROVED',
            wompiStatus: status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const userId = transactionDoc.data().userId;
        const plan = transactionDoc.data().plan;

        // Activar el plan para el usuario
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

        await admin.firestore().collection('usuarios').doc(userId).set({
          plan: plan,
          subscriptionEnds: admin.firestore.Timestamp.fromDate(subscriptionEndDate),
          lastPaymentRef: reference
        }, { merge: true });

        console.log(`Plan '${plan}' activado para el usuario ${userId}.`);
      }
    } else {
      await transactionRef.update({ 
          status: 'FAILED',
          wompiStatus: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Transacción ${reference} falló con estado: ${status}`);
    }
  }
  
  res.status(200).send('Evento recibido.');
});