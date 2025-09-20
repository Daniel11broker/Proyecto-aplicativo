const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const db = new sqlite3.Database('./suite_database.db', (err) => {
    if (err) {
        return console.error("Error al abrir la base de datos", err.message);
    }
    console.log('Conectado a la base de datos SQLite.');
    db.exec('PRAGMA journal_mode = WAL;');
    initializeDb();
});

// --- FUNCIÓN PARA HASHEAR LA CONTRASEÑA ---
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// --- FUNCIÓN PARA CREAR EL SUPERADMIN INICIAL ---
const createInitialSuperAdmin = () => {
    const superAdminUsername = "Daniel11Broker";
    const superAdminPassword = "001614Da";
    const hashedPassword = hashPassword(superAdminPassword);

    const checkSql = "SELECT * FROM admins WHERE username = ?";
    db.get(checkSql, [superAdminUsername], (err, row) => {
        if (err) {
            return console.error("Error al verificar superadmin:", err.message);
        }
        if (!row) {
            const insertSql = `INSERT INTO admins (username, passwordHash, role, status, userLimit) VALUES (?, ?, ?, ?, ?)`;
            db.run(insertSql, [superAdminUsername, hashedPassword, 'superadmin', 'Activo', null], (err) => {
                if (err) {
                    return console.error("Error al crear superadmin:", err.message);
                }
                console.log(`✅ ¡Superadministrador '${superAdminUsername}' creado exitosamente!`);
            });
        } else {
            console.log("El superadministrador ya existe.");
        }
    });
};

const initializeDb = () => {
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
        
        // **Llamamos a la función para crear el superadmin después de las tablas**
        createInitialSuperAdmin();
    });
};

// --- API Endpoints ---
// ... (El resto del archivo con los endpoints de la API se mantiene exactamente igual)

// Función genérica para crear endpoints CRUD
const createCrudEndpoints = (app, tableName) => {
    // GET all
    app.get(`/api/${tableName}`, (req, res) => {
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
            if (err) return res.status(500).json({ "error": err.message });
            // Parsear campos JSON si existen
            const parsedRows = rows.map(row => {
                try {
                    if (row.documents) row.documents = JSON.parse(row.documents);
                    if (row.leaves) row.leaves = JSON.parse(row.leaves);
                    if (row.payments) row.payments = JSON.parse(row.payments);
                    if (row.items) row.items = JSON.parse(row.items);
                } catch (e) {
                    console.error(`Error al parsear JSON para la fila con id ${row.id} en la tabla ${tableName}:`, e);
                }
                return row;
            });
            res.json(parsedRows);
        });
    });
     // GET one by ID
    app.get(`/api/${tableName}/:id`, (req, res) => {
        db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ "error": err.message });
            if (row) {
                 try {
                    if (row.documents) row.documents = JSON.parse(row.documents);
                    if (row.leaves) row.leaves = JSON.parse(row.leaves);
                    if (row.payments) row.payments = JSON.parse(row.payments);
                    if (row.items) row.items = JSON.parse(row.items);
                } catch (e) {
                     console.error(`Error al parsear JSON para la fila con id ${row.id} en la tabla ${tableName}:`, e);
                }
            }
            res.json(row);
        });
    });
    // POST new
    app.post(`/api/${tableName}`, (req, res) => {
        // Convertir objetos/arrays a JSON strings para guardar
        const body = { ...req.body };
        ['documents', 'leaves', 'payments', 'items'].forEach(key => {
            if (body[key] && typeof body[key] !== 'string') body[key] = JSON.stringify(body[key]);
        });
        const columns = Object.keys(body).join(', ');
        const placeholders = Object.keys(body).map(() => '?').join(', ');
        const values = Object.values(body);
        db.run(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values, function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.status(201).json({ id: this.lastID, ...req.body });
        });
    });
    // PUT update
    app.put(`/api/${tableName}/:id`, (req, res) => {
        const body = { ...req.body };
        ['documents', 'leaves', 'payments', 'items'].forEach(key => {
            if (body[key] && typeof body[key] !== 'string') body[key] = JSON.stringify(body[key]);
        });
        const updates = Object.keys(body).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(body), req.params.id];
        db.run(`UPDATE ${tableName} SET ${updates} WHERE id = ?`, values, function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ changes: this.changes });
        });
    });
    // DELETE
    app.delete(`/api/${tableName}/:id`, (req, res) => {
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, req.params.id, function(err) {
            if (err) return res.status(500).json({ "error": err.message });
            res.json({ changes: this.changes });
        });
    });
};

['admins', 'appUsers', 'paymentHistory', 'sgsst_employees', 'inventory', 'inventory_movements', 'debtors', 'clients', 'invoices'].forEach(table => {
    createCrudEndpoints(app, table);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const hashedInputPassword = hashPassword(password);
    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (admin) {
            if (admin.passwordHash === hashedInputPassword) {
                if (admin.status === 'Inactivo') return res.status(403).json({ message: "Cuenta de administrador inactiva." });
                const { passwordHash, ...adminData } = admin;
                return res.json({ user: adminData });
            }
        }
        db.get("SELECT * FROM appUsers WHERE username = ?", [username], (err, appUser) => {
            if (err) return res.status(500).json({ "error": err.message });
            if (appUser && appUser.passwordHash === hashedInputPassword) {
                 if (appUser.status === 'Inactivo') return res.status(403).json({ message: "Cuenta inactiva." });
                const { passwordHash, ...userData } = appUser;
                return res.json({ user: userData });
            }
            return res.status(401).json({ message: "Usuario o contraseña incorrectos." });
        });
    });
});

app.get('/api', (req, res) => {
    res.json({ message: "¡Bienvenido a la API de la Suite Empresarial!" });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log(`Prueba la API en: http://localhost:${port}/api`);
});