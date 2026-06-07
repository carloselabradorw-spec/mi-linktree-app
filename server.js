const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ CONFIGURACIÓN CRÍTICA: Procesamiento de datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ CONFIGURACIÓN DEL CERROJO
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

// 🟢 RUTA PÚBLICA: Obtener todos los enlaces para pintar los botones
app.get('/api/enlaces', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM enlaces ORDER BY id ASC');
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al leer enlaces:", error);
        res.status(500).json({ error: "Error de servidor al leer los datos" });
    }
});

// 🔵 RUTA PROTEGIDA: Añadir un nuevo enlace
app.post('/api/enlaces', seguridadAdmin, async (req, res) => {
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

// 🔴 RUTA PROTEGIDA: Eliminar un enlace por su ID
app.post('/api/eliminar-enlace', seguridadAdmin, async (req, res) => {
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

// 🖥️ RUTA PROTEGIDA: Mostrar el panel (Ahora sí pasará por el cerrojo primero)
app.get('/admin', seguridadAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 📱 RUTA PÚBLICA: Mostrar la tarjeta cliente al escanear el NFC
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📁 ARCHIVOS ESTÁTICOS AL FINAL: Así no interfieren con las rutas protegidas
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});