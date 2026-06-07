const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ CONFIGURACIÓN CRÍTICA: Procesamiento de datos de formularios
// Esto debe ir arriba del todo, antes de las rutas, para que funcione el borrado.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir los archivos de la carpeta pública
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 Conexión con tu Base de Datos de Render (URL EXTERNA INTEGRADA)
const pool = new Pool({
  connectionString: "postgresql://base_enlaces_user:p7i7iboiGd3X1HHuRGTNukKABLPrOrJP@dpg-d8il6fuq1p3s73eroev0-a.frankfurt-postgres.render.com/base_enlaces",
  ssl: {
    rejectUnauthorized: false // Requerido para conectar desde fuera de Render (tu ordenador)
  }
});

// Inicializar la tabla en PostgreSQL si no existe
const inicializarBaseDatos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS enlaces (
                id SERIAL PRIMARY KEY,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL
            );
        `);
        console.log("¡Conexión exitosa! Base de datos lista y conectada.");
    } catch (error) {
        console.error("Error al conectar la base de datos:", error);
    }
};
inicializarBaseDatos();

// 🟢 RUTA: Obtener todos los enlaces (Ordenados por ID)
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY id ASC');
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al leer enlaces:", error);
        res.status(500).json({ error: "Error de servidor al leer los datos" });
    }
});

// 🔵 RUTA: Añadir un nuevo enlace
app.post('/api/enlaces', async (req, res) => {
    const { titulo, url } = req.body;
    if (titulo && url) {
        try {
            await pool.query('INSERT INTO enlaces (titulo, url) VALUES ($1, $2)', [titulo, url]);
            console.log(`Enlace añadido correctamente: ${titulo}`);
        } catch (error) {
            console.error("Error al insertar enlace:", error);
        }
    }
    res.redirect('/admin');
});

// 🔴 RUTA: Eliminar un enlace por su ID (REVISADA)
app.post('/api/eliminar-enlace', async (req, res) => {
    // Forzamos a que lea el id enviado desde el formulario de admin.html
    const idEnlace = req.body.id ? parseInt(req.body.id, 10) : null;
    
    console.log("--> Intentando borrar el ID de la base de datos:", idEnlace);

    if (idEnlace && !isNaN(idEnlace)) {
        try {
            const respuestaBorrado = await pool.query('DELETE FROM enlaces WHERE id = $1', [idEnlace]);
            console.log(`Resultado del borrado: Se eliminaron ${respuestaBorrado.rowCount} filas.`);
        } catch (error) {
            console.error("Error crítico en la consulta de borrado:", error);
        }
    } else {
        console.log("Advertencia: El servidor recibió un ID vacío o inválido:", req.body.id);
    }

    res.redirect('/admin');
});

// Rutas para mostrar las pantallas
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});