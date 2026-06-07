const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ CERROJO DE SEGURIDAD
const seguridadAdmin = basicAuth({
    users: { 'carlos': 'CarlosNFC2026' }, 
    challenge: true, 
    realm: 'Panel Privado'
});

// 📁 CONFIGURACIÓN DE ALMACENAMIENTO PARA IMÁGENES
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Guardamos la foto siempre con el nombre 'perfil' + su extensión para controlarla fácilmente
        const ext = path.extname(file.originalname);
        cb(null, 'perfil' + ext);
    }
});
const upload = multer({ storage: storage });

// Servir archivos estáticos de la carpeta public (imágenes, css, etc)
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 Conexión con tu Base de Datos de Render
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a.frankfurt-postgres.render.com/base_enlaces",
  ssl: { rejectUnauthorized: false }
});

// 🟢 API PÚBLICA: Obtener enlaces
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY posicion ASC, id ASC');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: "Error de servidor" });
    }
});

// 📸 API PÚBLICA: Saber si hay foto de perfil actual
app.get('/api/perfil', (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(dir)) {
        const archivos = fs.readdirSync(dir);
        const foto = archivos.find(f => f.startsWith('perfil'));
        if (foto) {
            return res.json({ existe: true, url: `/uploads/${foto}` });
        }
    }
    res.json({ existe: false });
});

// 🖥️ RUTA PROTEGIDA: Mostrar el panel de control
app.get('/admin', seguridadAdmin, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'admin.html'));
});

// 🔵 RUTA PROTEGIDA: Añadir enlace
app.post('/api/enlaces', seguridadAdmin, async (req, res) => {
    const { titulo, url, posicion } = req.body;
    const ordenNum = posicion ? parseInt(posicion, 10) : 0;
    if (titulo && url) {
        try {
            await pool.query('INSERT INTO enlaces (titulo, url, posicion) VALUES ($1, $2, $3)', [titulo, url, ordenNum]);
        } catch (error) {
            console.error(error);
        }
    }
    res.redirect('/admin');
});

// 🟡 RUTA PROTEGIDA: Ordenar enlaces
app.post('/api/ordenar-enlaces', seguridadAdmin, async (req, res) => {
    const { posiciones } = req.body;
    try {
        if (posiciones && typeof posiciones === 'object') {
            for (const [id, pos] of Object.entries(posiciones)) {
                await pool.query('UPDATE enlaces SET posicion = $1 WHERE id = $2', [parseInt(pos, 10), parseInt(id, 10)]);
            }
            return res.json({ success: true });
        }
        res.status(400).json({ error: "Datos inválidos" });
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

// 🔴 RUTA PROTEGIDA: Eliminar un enlace
app.post('/api/eliminar-enlace', seguridadAdmin, async (req, res) => {
    const idEnlace = req.body.id ? parseInt(req.body.id, 10) : null;
    if (idEnlace && !isNaN(idEnlace)) {
        try {
            await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
        } catch (error) {
            console.error(error);
        }
    }
    res.redirect('/admin');
});

// 🔼 RUTA PROTEGIDA: Subir o Modificar Imagen
app.post('/api/perfil/subir', seguridadAdmin, upload.single('imagenPerfil'), (req, res) => {
    // Si ya subió el archivo, multer hace la magia. Volvemos al admin
    res.redirect('/admin');
});

// 🔽 RUTA PROTEGIDA: Quitar/Borrar Imagen
app.post('/api/perfil/eliminar', seguridadAdmin, (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(dir)) {
        const archivos = fs.readdirSync(dir);
        archivos.forEach(archivo => {
            if (archivo.startsWith('perfil')) {
                fs.unlinkSync(path.join(dir, archivo)); // Borra el archivo del disco
            }
        });
    }
    res.redirect('/admin');
});

// 📱 RUTA PÚBLICA: Vista raíz cliente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});