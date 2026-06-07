const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Procesamiento de datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔐 CERROJO DE SEGURIDAD (Activo y obligatorio)
const seguridadAdmin = basicAuth({
    users: { 'carlos': 'CarlosNFC2026' }, 
    challenge: true, 
    realm: 'Panel Privado'
});

// 📁 CARPETA PÚBLICA: Solo para index.html (Vista del cliente)
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 Conexión con tu Base de Datos de Render
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a.frankfurt-postgres.render.com/base_enlaces",
  ssl: {
    rejectUnauthorized: false 
  }
});

// Inicializar la tabla en PostgreSQL
const inicializarBaseDatos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS enlaces (
                id SERIAL PRIMARY KEY,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                posicion INTEGER DEFAULT 0
            );
        `);
        await pool.query(`ALTER TABLE enlaces ADD COLUMN IF NOT EXISTS posicion INTEGER DEFAULT 0;`);
        console.log("¡Base de datos lista!");
    } catch (error) {
        console.error("Error en base de datos:", error);
    }
};
inicializarBaseDatos();

// 🟢 RUTA PÚBLICA: Obtener enlaces para pintar los botones
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY posicion ASC, id ASC');
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al leer enlaces:", error);
        res.status(500).json({ error: "Error de servidor" });
    }
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
            console.error("Error al insertar:", error);
        }
    }
    res.redirect('/admin');
});

// 🟡 RUTA PROTEGIDA: Guardar orden de las flechas
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
        console.error("Error al ordenar:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// 🔴 RUTA PROTEGIDA: Eliminar un enlace
app.post('/api/eliminar-enlace', seguridadAdmin, async (req, res) => {
    const idEnlace = req.body.id ? parseInt(req.body.id, 10) : null;
    if (idEnlace && !isNaN(idEnlace)) {
        try {
            await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    }
    res.redirect('/admin');
});

// 📱 RUTA PÚBLICA: Vista raíz cliente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});