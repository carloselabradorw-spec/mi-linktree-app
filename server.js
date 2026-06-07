const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Configuración de Express para leer los formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const ARCHIVO_DATOS = path.join(__dirname, 'enlaces.json');

// Función para leer el archivo JSON
function leerEnlaces() {
    try {
        if (!fs.existsSync(ARCHIVO_DATOS)) {
            const defecto = [
                { titulo: "Mi Sitio Web", url: "https://tupaginaweb.com" },
                { titulo: "Mi WhatsApp", url: "https://wa.me/123456789" }
            ];
            fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(defecto, null, 2));
            return defecto;
        }
        const datos = fs.readFileSync(ARCHIVO_DATOS, 'utf-8');
        return JSON.parse(datos);
    } catch (error) {
        console.error("Error al leer el archivo:", error);
        return [];
    }
}

// RUTA: Enviar enlaces al HTML
app.get('/api/enlaces', (req, res) => {
    res.json(leerEnlaces());
});

// RUTA: Añadir un nuevo enlace desde el formulario
app.post('/api/enlaces', (req, res) => {
    const misEnlaces = leerEnlaces();
    const nuevoEnlace = { titulo: req.body.titulo, url: req.body.url };
    
    if (nuevoEnlace.titulo && nuevoEnlace.url) {
        misEnlaces.push(nuevoEnlace);
        fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(misEnlaces, null, 2));
    }
    
    res.redirect('http://localhost:3000/admin');
});

// RUTA: Eliminar un enlace (¡Ahora sí, bien colocada!)
app.post('/api/eliminar-enlace', (req, res) => {
    const misEnlaces = leerEnlaces();
    const indice = parseInt(req.body.id);

    if (!isNaN(indice) && indice >= 0 && indice < misEnlaces.length) {
        misEnlaces.splice(indice, 1);
        fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(misEnlaces, null, 2));
    }

    res.redirect('http://localhost:3000/admin');
});

// RUTA PRIVADA: Cargar panel de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// RUTA PÚBLICA: Cargar tarjeta del NFC
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🚨 SIEMPRE AL FINAL: Encender el servidor cuando ya conoce todas las rutas
app.listen(PORT, () => {
    console.log(`Servidor listo en: http://localhost:${PORT}`);
});