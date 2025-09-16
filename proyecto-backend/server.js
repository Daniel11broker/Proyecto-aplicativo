// -----------------------------------------------------------------------------
// SERVIDOR BACKEND PARA SUITE EMPRESARIAL - PLAN PRO
// -----------------------------------------------------------------------------

// --- 1. Importación de Módulos ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path'); // Módulo para manejar rutas de archivos

// --- 2. Configuración Inicial ---
const app = express();
const port = 3000;
const dbFile = './suite_empresarial_pro.db';

// --- 3. Middlewares ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- 4. Rutas para Archivos del Frontend ---

// Sirve todos los archivos (CSS, JS, imágenes, etc.) desde la carpeta 'todo'
// Esto permite que todos los enlaces relativos en tu HTML funcionen.
app.use(express.static(path.join(__dirname, '..', 'todo')));

// Sirve específicamente el archivo index.html cuando se visita la raíz "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'todo', 'index.html'));
});


// --- 5. Conexión a la Base de Datos SQLite ---
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err.message);
    } else {
        console.log("Conexión exitosa a la base de datos SQLite.");
        db.serialize(() => {
            console.log("Creando tablas si no existen...");
            
            // Módulo de Cobranza
            db.run(`CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                idNumber TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS debtors (
                id INTEGER PRIMARY KEY,
                clientId INTEGER NOT NULL,
                documentType TEXT,
                invoiceNumber TEXT,
                subtotal REAL DEFAULT 0,
                totalWithIVA REAL DEFAULT 0,
                dueDate TEXT,
                status TEXT,
                notes TEXT,
                FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
            )`);

            // Módulo de Inventario
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                sku TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                quantity INTEGER DEFAULT 0,
                costPrice REAL DEFAULT 0,
                salePrice REAL DEFAULT 0
            )`);

            console.log("Estructura de la base de datos lista.");
        });
    }
});


// --- 6. API Endpoints (Rutas para manejar los datos) ---

// --- Endpoints para el Módulo de Cobranza ---

app.get('/api/clients', (req, res) => {
    db.all("SELECT * FROM clients ORDER BY name", [], (err, rows) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json(rows);
    });
});

app.get('/api/debtors', (req, res) => {
    const sql = `
        SELECT d.*, c.name as clientName 
        FROM debtors d
        JOIN clients c ON d.clientId = c.id
        ORDER BY d.dueDate DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json(rows);
    });
});

// ... (Aquí irían el resto de tus rutas de la API: POST, PUT, DELETE, etc.)


// --- 7. Iniciar el Servidor ---
app.listen(port, () => {
    console.log(`Servidor iniciado y escuchando en http://localhost:${port}`);
    console.log("Asegúrate de ejecutar 'node server.js' DESDE la carpeta 'proyecto-backend'.");
});