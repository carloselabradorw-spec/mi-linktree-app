const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔐 CERROJO DE SEGURIDAD (Activo)
const seguridadAdmin = basicAuth({
    users: { 'carlos': 'CarlosNFC2026' }, 
    challenge: true, 
    realm: 'Panel Privado'
});

// 🔌 Conexión con tu Base de Datos de Render (URL EXTERNA)
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a.frankfurt-postgres.render.com/base_enlaces",
  ssl: {
    rejectUnauthorized: false 
  }
});

// Inicializar la tabla en PostgreSQL (Con columna de orden automático)
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
        console.log("¡Conexión exitosa! Base de datos lista, ordenada y conectada.");
    } catch (error) {
        console.error("Error al conectar la base de datos:", error);
    }
};
inicializarBaseDatos();

// 🟢 RUTA PÚBLICA: Obtener todos los enlaces ordenados (Para la tarjeta del cliente)
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY posicion ASC, id ASC');
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al leer enlaces:", error);
        res.status(500).json({ error: "Error de servidor al leer los datos" });
    }
});

// 🔵 RUTA PROTEGIDA: Añadir un nuevo enlace
app.post('/api/enlaces', seguridadAdmin, async (req, res) => {
    const { titulo, url, posicion } = req.body;
    const ordenNum = posicion ? parseInt(posicion, 10) : 0;
    if (titulo && url) {
        try {
            await pool.query('INSERT INTO enlaces (titulo, url, posicion) VALUES ($1, $2, $3)', [titulo, url, ordenNum]);
            console.log(`Enlace añadido correctamente: ${titulo} en posición ${ordenNum}`);
        } catch (error) {
            console.error("Error al insertar enlace:", error);
        }
    }
    res.redirect('/admin');
});

// 🟡 RUTA PROTEGIDA: Guardar las nuevas posiciones al usar las flechas
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
        console.error("Error al actualizar posiciones:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// 🔴 RUTA PROTEGIDA: Eliminar un enlace
app.post('/api/eliminar-enlace', seguridadAdmin, async (req, res) => {
    const idEnlace = req.body.id ? parseInt(req.body.id, 10) : null;
    if (idEnlace && !isNaN(idEnlace)) {
        try {
            await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
            console.log(`ID ${idEnlace} eliminado.`);
        } catch (error) {
            console.error("Error crítico en la consulta de borrado:", error);
        }
    }
    res.redirect('/admin');
});

// 🖥️ RUTA PROTEGIDA: Mostrar el panel de control
app.get('/admin', seguridadAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 📱 RUTA PÚBLICA: Vista NFC libre para los clientes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Archivos estáticos al final para que no rompan el candado
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});