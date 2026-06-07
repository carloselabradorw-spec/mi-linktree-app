const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ CERROJO DE SEGURIDAD (Obligatorio para admin)
const seguridadAdmin = basicAuth({
    users: { 'carlos': 'CarlosNFC2026' }, 
    challenge: true, 
    realm: 'Panel Privado'
});

// Configuración de almacenamiento para la imagen de perfil
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'perfil' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Servir archivos estáticos (index.html, css, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a Base de Datos
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a.frankfurt-postgres.render.com/base_enlaces",
  ssl: { rejectUnauthorized: false }
});

// Inicializar tabla
const inicializarBaseDatos = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS enlaces (id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, url TEXT NOT NULL, posicion INTEGER DEFAULT 0);`);
        await pool.query(`ALTER TABLE enlaces ADD COLUMN IF NOT EXISTS posicion INTEGER DEFAULT 0;`);
    } catch (e) { console.error("Error BD:", e); }
};
inicializarBaseDatos();

// API: Obtener enlaces
app.get('/api/enlaces', async (req, res) => {
    const resBD = await pool.query('SELECT * FROM enlaces ORDER BY posicion ASC, id ASC');
    res.json(resBD.rows);
});

// API: Saber si existe foto perfil
app.get('/api/perfil', (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) return res.json({ existe: false });
    const archivos = fs.readdirSync(dir);
    const foto = archivos.find(f => f.startsWith('perfil'));
    res.json(foto ? { existe: true, url: `/uploads/${foto}` } : { existe: false });
});

// 🖥️ RUTA PROTEGIDA: Panel admin (Uso de ruta absoluta en la raíz)
app.get('/admin', seguridadAdmin, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'admin.html'));
});

// Rutas de acciones protegidas
app.post('/api/enlaces', seguridadAdmin, async (req, res) => {
    const { titulo, url, posicion } = req.body;
    await pool.query('INSERT INTO enlaces (titulo, url, posicion) VALUES ($1, $2, $3)', [titulo, url, posicion || 0]);
    res.redirect('/admin');
});

app.post('/api/ordenar-enlaces', seguridadAdmin, async (req, res) => {
    for (const [id, pos] of Object.entries(req.body.posiciones)) {
        await pool.query('UPDATE enlaces SET posicion = $1 WHERE id = $2', [pos, id]);
    }
    res.json({ success: true });
});

app.post('/api/eliminar-enlace', seguridadAdmin, async (req, res) => {
    await pool.query('DELETE FROM enlaces WHERE id = $1', [req.body.id]);
    res.redirect('/admin');
});

app.post('/api/perfil/subir', seguridadAdmin, upload.single('imagenPerfil'), (req, res) => {
    res.redirect('/admin');
});

app.post('/api/perfil/eliminar', seguridadAdmin, (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => { if (file.startsWith('perfil')) fs.unlinkSync(path.join(dir, file)); });
    }
    res.redirect('/admin');
});

// Vista principal cliente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});