const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// Configuración de Express para leer los formularios y JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 Conexión con tu Base de Datos PostgreSQL de Render
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a/base_enlaces",
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones seguras con Render desde fuera
  }
});

// 🛠️ Crear la tabla automáticamente si no existe al arrancar el servidor
const inicializarBaseDatos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS enlaces (
                id SERIAL PRIMARY KEY,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL
            );
        `);
        console.log("Base de datos conectada y tabla 'enlaces' lista.");
    } catch (error) {
        console.error("Error al inicializar la base de datos:", error);
    }
};
inicializarBaseDatos();

// 🟢 RUTA API: Enviar los enlaces guardados al HTML (Ordenados por ID)
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY id ASC');
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener enlaces:", error);
        res.status(500).json({ error: "Error al leer la base de datos" });
    }
});

// 🔵 RUTA API: Añadir un nuevo enlace desde el formulario del panel
app.post('/api/enlaces', async (req, res) => {
    const { titulo, url } = req.body;
    
    if (titulo && url) {
        try {
            await pool.query('INSERT INTO enlaces (titulo, url) VALUES ($1, $2)', [titulo, url]);
            console.log(`¡Enlace añadido con éxito!: ${titulo}`);
        } catch (error) {
            console.error("Error al insertar el enlace:", error);
        }
    }
    
    res.redirect('/admin');
});

// 🔴 RUTA API: Eliminar un enlace de la base de datos por su ID
app.post('/api/eliminar-enlace', async (req, res) => {
    const idEnlace = parseInt(req.body.id);
    console.log("Orden de borrar recibida para el ID:", idEnlace);

    if (!isNaN(idEnlace)) {
        try {
            await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
            console.log("¡Enlace eliminado con éxito de PostgreSQL!");
        } catch (error) {
            console.error("Error al eliminar el enlace:", error);
        }
    } else {
        console.log("Error: El ID recibido no es válido.");
    }

    res.redirect('/admin');
});

// 🖥️ RUTA PRIVADA: Cargar el panel de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 📱 RUTA PÚBLICA: Cargar la tarjeta de presentación del NFC
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🚀 ENCENDER EL SERVIDOR (Siempre al final)
app.listen(PORT, () => {
    console.log(`Servidor con PostgreSQL listo en: http://localhost:${PORT}`);
});