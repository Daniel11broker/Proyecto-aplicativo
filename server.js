const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

// <-- NUEVO: Importar los paquetes de seguridad
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const app = express();
const port = 3000;

// --- Middlewares de Seguridad ---
app.use(cors());
app.use(helmet()); // <-- NUEVO: Helmet añade 11 middlewares de seguridad HTTP
app.use(express.json({ limit: '10mb' }));

// Factor de trabajo para bcrypt. 10 es un valor seguro y estándar.
const saltRounds = 10;

// --- Conexión a la Base de Datos ---
const db = new sqlite3.Database('./suite_database.db', (err) => {
    if (err) {
        return console.error("Error al abrir la base de datos", err.message);
    }
    console.log('Conectado a la base de datos SQLite.');
    db.exec('PRAGMA journal_mode = WAL;');
    initializeDb();
});

// --- Lógica de Inicialización de la Base de Datos ---

const createInitialSuperAdmin = async () => {
    const superAdminUsername = "Daniel11Broker";
    const superAdminPassword = "001614Da";
    
    const checkSql = "SELECT * FROM admins WHERE username = ?";
    db.get(checkSql, [superAdminUsername], async (err, row) => {
        if (err) return console.error("Error al verificar superadmin:", err.message);
        
        if (!row) {
            // <-- NUEVO: Hasheo seguro con bcrypt
            const passwordHash = await bcrypt.hash(superAdminPassword, saltRounds);
            const insertSql = `INSERT INTO admins (username, passwordHash, role, status) VALUES (?, ?, ?, ?)`;
            db.run(insertSql, [superAdminUsername, passwordHash, 'superadmin', 'Activo'], (err) => {
                if (err) return console.error("Error al crear superadmin:", err.message);
                console.log(`✅ ¡Superadministrador '${superAdminUsername}' creado exitosamente!`);
            });
        } else {
            console.log("El superadministrador ya existe.");
        }
    });
};

const initializeDb = () => {
    // ... (El resto de la función initializeDb se mantiene igual)
    const tableCreationScripts = [
        `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, passwordHash TEXT, role TEXT, status TEXT, userLimit INTEGER)`,
        `CREATE TABLE IF NOT EXISTS appUsers (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, passwordHash TEXT, role TEXT, adminId INTEGER, status TEXT, FOREIGN KEY (adminId) REFERENCES admins(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS paymentHistory (id INTEGER PRIMARY KEY AUTOINCREMENT, adminId INTEGER, paymentMonth TEXT, paymentDate TEXT, amount REAL, status TEXT, FOREIGN KEY (adminId) REFERENCES admins(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS sgsst_employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, idNumber TEXT UNIQUE, position TEXT, department TEXT, status TEXT, baseSalary REAL, contractType TEXT, contractStart TEXT, vacationDays INTEGER, documents TEXT, leaves TEXT)`,
        `CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sku TEXT UNIQUE, category TEXT, description TEXT, costPrice REAL, salePrice REAL, quantity INTEGER, lowStockThreshold INTEGER, reorderPoint INTEGER, batch TEXT, expiryDate TEXT, supplierId INTEGER, location TEXT)`,
        `CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER, date TEXT, type TEXT, quantityChange TEXT, newQuantity INTEGER, reason TEXT, FOREIGN KEY(productId) REFERENCES inventory(id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS debtors (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId INTEGER, documentType TEXT, invoiceNumber TEXT, totalWithIVA REAL, dueDate TEXT, notes TEXT, status TEXT, payments TEXT, retencionFuente REAL, retencionICA REAL)`,
        `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, idNumber TEXT)`,
        `CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, clientId INTEGER, clientName TEXT, issueDate TEXT, total REAL, subtotal REAL, iva REAL, retefuente REAL, ica REAL, status TEXT, items TEXT)`,
    ];

    db.serialize(() => {
        tableCreationScripts.forEach(script => {
            db.run(script, (err) => {
                if (err) console.error(`Error creando tabla: ${err.message}`);
            });
        });
        console.log("Todas las tablas han sido aseguradas.");
        createInitialSuperAdmin();
    });
};

// --- API Endpoints con Seguridad Mejorada ---

// GET (Leer) - No necesita cambios drásticos, ya es seguro si no expones datos sensibles.
app.get('/api/admins', (req, res) => {
    // Excluimos el hash de la contraseña de la respuesta
    db.all("SELECT id, username, role, status, userLimit FROM admins", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});


// POST (Crear) - Con validación y hashing seguro
app.post('/api/admins',
    // <-- NUEVO: Reglas de validación y saneamiento
    body('username').isLength({ min: 3 }).withMessage('El usuario debe tener al menos 3 caracteres.').trim().escape(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
    body('role').isIn(['admin', 'superadmin']).withMessage('Rol inválido.'),
    body('status').isIn(['Activo', 'Inactivo']).withMessage('Estado inválido.'),
    body('userLimit').optional().isInt({ min: 1 }).withMessage('El límite de usuarios debe ser un número mayor a 0.'),
    
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { username, password, role, status, userLimit } = req.body;
        const passwordHash = await bcrypt.hash(password, saltRounds); // <-- NUEVO: Hashing con bcrypt

        const sql = `INSERT INTO admins (username, passwordHash, role, status, userLimit) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [username, passwordHash, role, status, userLimit], function(err) {
            if (err) {
                // Error de SQLite para usuario duplicado
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
                }
                return res.status(400).json({ "error": err.message });
            }
            res.status(201).json({ id: this.lastID });
        });
    }
);

// PUT (Actualizar) - Con validación y hashing condicional
app.put('/api/admins/:id', 
    // <-- NUEVO: Validación también para actualizar
    body('username').isLength({ min: 3 }).trim().escape(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres.'),
    body('role').isIn(['admin', 'superadmin']),
    body('status').isIn(['Activo', 'Inactivo']),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
    
        const { username, password, role, status, userLimit } = req.body;
        let query, params;

        if (password) {
            // Si se proporciona una nueva contraseña, la hasheamos
            const passwordHash = await bcrypt.hash(password, saltRounds);
            query = `UPDATE admins SET username = ?, passwordHash = ?, role = ?, status = ?, userLimit = ? WHERE id = ?`;
            params = [username, passwordHash, role, status, userLimit, req.params.id];
        } else {
            // Si no, actualizamos todo excepto la contraseña
            query = `UPDATE admins SET username = ?, role = ?, status = ?, userLimit = ? WHERE id = ?`;
            params = [username, role, status, userLimit, req.params.id];
        }

        db.run(query, params, function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ changes: this.changes });
        });
    }
);


// LOGIN - Con comparación segura de bcrypt
app.post('/api/login', 
    body('username').trim().escape(),
    async (req, res) => {
        const { username, password } = req.body;

        const findUser = (table) => {
            return new Promise((resolve, reject) => {
                db.get(`SELECT * FROM ${table} WHERE username = ?`, [username], (err, user) => {
                    if (err) return reject(err);
                    resolve(user);
                });
            });
        };

        try {
            let user = await findUser('admins') || await findUser('appUsers');

            if (!user) {
                return res.status(401).json({ message: "Usuario o contraseña incorrectos." });
            }

            // <-- NUEVO: Comparación segura con bcrypt
            const match = await bcrypt.compare(password, user.passwordHash);

            if (!match) {
                return res.status(401).json({ message: "Usuario o contraseña incorrectos." });
            }
            
            if (user.status === 'Inactivo') {
                return res.status(403).json({ message: "Tu cuenta está desactivada." });
            }

            const { passwordHash, ...userData } = user; // Nunca devolver el hash
            res.json({ user: userData });

        } catch (err) {
            res.status(500).json({ "error": err.message });
        }
    }
);

// ... (El resto de tus endpoints CRUD y el app.listen se mantienen igual)
// ... Asegúrate de aplicar la misma lógica de validación a las rutas de `appUsers`

app.delete('/api/admins/:id', (req, res) => {
    db.run(`DELETE FROM admins WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ changes: this.changes });
    });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});