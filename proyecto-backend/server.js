// -----------------------------------------------------------------------------
// SERVIDOR BACKEND PARA SUITE EMPRESARIAL - AUTENTICACIÓN CON SQLITE v5 (ESTABLE)
// -----------------------------------------------------------------------------

// --- 1. Importación de Módulos ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// --- 2. Configuración Inicial ---
const app = express();
const port = 3000;
const dbFile = './suite_empresarial_pro.db';
const saltRounds = 10;
const SUPER_ADMIN_EMAIL = "daniel11broker@example.com";

// --- 3. Middlewares (en el orden correcto y crítico) ---
app.use(cors({
    origin: `http://localhost:${port}`,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: __dirname
    }),
    secret: 'un_secreto_muy_fuerte_y_largo_para_la_app',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 días
  })
);

// --- 4. Conexión a la Base de Datos SQLite ---
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) return console.error("Error al abrir la base de datos:", err.message);
    
    console.log("Conexión exitosa a la base de datos SQLite.");
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, createdAt TEXT, activeUntil TEXT)`);
        
        const superAdminPassword = 'superadminpassword'; // ¡IMPORTANTE: Cambia esta contraseña!
        bcrypt.hash(superAdminPassword, saltRounds, (err, hash) => {
            if (err) return console.error("Error al encriptar la contraseña del super admin");
            db.run('INSERT OR IGNORE INTO users (email, password, role, createdAt, activeUntil) VALUES (?, ?, ?, ?, NULL)', [SUPER_ADMIN_EMAIL, hash, 'superadmin', new Date().toISOString()], function(err) {
                if (!err && this.changes > 0) {
                    console.log(`Super admin '${SUPER_ADMIN_EMAIL}' creado. Contraseña: ${superAdminPassword}`);
                }
            });
        });
        
        console.log("Estructura de la base de datos verificada.");
    });
});

// --- 5. Middlewares de Autorización ---
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ error: 'No autorizado. Por favor, inicie sesión.' });
};
const isSuperAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'superadmin') return next();
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Super Administrador.' });
};

// --- 6. API Endpoints (Rutas de la API) ---
// Estas rutas deben estar ANTES de servir los archivos estáticos.

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
        if (user.activeUntil && new Date(user.activeUntil) < new Date()) return res.status(403).json({ error: 'Tu cuenta ha expirado.' });
        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                req.session.userId = user.id;
                req.session.email = user.email;
                req.session.role = user.role;
                res.json({ email: user.email, role: user.role });
            } else {
                res.status(401).json({ error: 'Email o contraseña incorrectos.' });
            }
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'No se pudo cerrar la sesión' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Sesión cerrada' });
    });
});

app.get('/api/users', isAuthenticated, isSuperAdmin, (req, res) => {
    db.all("SELECT id, email, role, createdAt, activeUntil FROM users ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});

app.post('/api/users', isAuthenticated, isSuperAdmin, (req, res) => {
    const { email, password, role, activeUntil } = req.body;
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: "Error al encriptar la contraseña." });
        const sql = `INSERT INTO users (email, password, role, createdAt, activeUntil) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [email, hash, role, new Date().toISOString(), activeUntil], function(err) {
            if (err) return res.status(400).json({ "error": "El email ya está en uso." });
            res.status(201).json({ id: this.lastID, email, role, activeUntil });
        });
    });
});

app.put('/api/users/:id', isAuthenticated, isSuperAdmin, (req, res) => {
    const { activeUntil } = req.body;
    const sql = `UPDATE users SET activeUntil = ? WHERE id = ?`;
    db.run(sql, [activeUntil, req.params.id], function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/users/:id', isAuthenticated, isSuperAdmin, (req, res) => {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Usuario no encontrado." });
        res.json({ deleted: this.changes });
    });
});

// --- 7. Servir Archivos del Frontend (DEBE IR AL FINAL) ---
// Esto sirve el index.html en la raíz y todos los demás archivos
// como CSS, JS, etc., desde la carpeta 'todo'.
app.use(express.static(path.join(__dirname, '..', 'todo')));

// --- 8. Iniciar el Servidor ---
app.listen(port, () => {
    console.log(`Servidor iniciado y escuchando en http://localhost:${port}`);
});