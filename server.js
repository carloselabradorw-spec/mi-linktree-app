const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000; // Adaptado para Render

// ⚙️ CONFIGURACIÓN CRÍTICA: Esto DEBE ir antes de las rutas para que funcione el borrado
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos de tu carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 Conexión con tu Base de Datos PostgreSQL de Render
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a/base_enlaces",
  ssl: {
    rejectUnauthorized: false
  }
});

// 🛠️ Inicializar tabla
const inicializarBaseDatos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS enlaces (
                id SERIAL PRIMARY KEY,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL
            );
        `);
        console.log("Base de datos lista.");
    } catch (error) {
        console.error("Error base de datos:", error);
    }
};
inicializarBaseDatos();

// 🟢 Obtener enlaces
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY id ASC');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al leer la base de datos" });
    }
});

// 🔵 Añadir enlace
app.post('/api/enlaces', async (req, res) => {
    const { titulo, url } = req.body;
    if (titulo && url) {
        try {
            await pool.query('INSERT INTO enlaces (titulo, url) VALUES ($1, $2)', [titulo, url]);
        } catch (error) {
            console.error(error);
        }
    }
    res.redirect('/admin');
});

// 🔴 ELIMINAR ENLACE (CORREGIDO)
app.post('/api/eliminar-enlace', async (req, res) => {
    // Convertimos a número lo que llega del formulario
    const idEnlace = parseInt(req.body.id, 10);

    if (!isNaN(idEnlace)) {
        try {
            // Hacemos la consulta directa a PostgreSQL
            await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
            console.log(`Enlace con ID ${idEnlace} eliminado correctamente.`);
        } catch (error) {
            console.error("Error al borrar en la base de datos:", error);
        }
    } else {
        console.log("Error: No se recibió un ID válido en el servidor.");
    }

    res.redirect('/admin');
});

// Rutas de las páginas
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});