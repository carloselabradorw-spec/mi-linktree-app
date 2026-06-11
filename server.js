const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

cargarEnvLocal();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || 'carlos';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CarlosNFC2026';
const DEFAULT_PUBLIC_NAME = process.env.DEFAULT_PUBLIC_NAME || 'Carlos Labrador';
const DEFAULT_PUBLIC_DESCRIPTION = process.env.DEFAULT_PUBLIC_DESCRIPTION || 'Bienvenidos a mi espacio digital. Conecta conmigo a traves de mis redes.';
const DEFAULT_SLUG = limpiarSlug(process.env.DEFAULT_SLUG || DEFAULT_ADMIN_USER);

function cargarEnvLocal() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const lineas = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lineas.forEach((linea) => {
        const texto = linea.trim();
        if (!texto || texto.startsWith('#')) return;
        const posicionIgual = texto.indexOf('=');
        if (posicionIgual === -1) return;
        const clave = texto.slice(0, posicionIgual).trim();
        const valor = texto.slice(posicionIgual + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[clave]) process.env[clave] = valor;
    });
}

function limpiarSlug(valor) {
    return String(valor || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'usuario';
}

function crearHashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function comprobarPassword(password, passwordHash) {
    if (!passwordHash || !passwordHash.includes(':')) return false;
    const [salt, hashGuardado] = passwordHash.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hashGuardado, 'hex'), Buffer.from(hash, 'hex'));
}

async function inicializarBaseDatos() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                nombre_publico TEXT NOT NULL,
                descripcion TEXT NOT NULL DEFAULT '',
                creado_en TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS enlaces (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                titulo TEXT NOT NULL,
                url TEXT NOT NULL,
                posicion INTEGER DEFAULT 0
            );
        `);

        await pool.query('ALTER TABLE enlaces ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;');
        await pool.query('ALTER TABLE enlaces ADD COLUMN IF NOT EXISTS posicion INTEGER DEFAULT 0;');
        await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT \'\';');

        const usuario = await asegurarUsuarioPrincipal();
        await pool.query('UPDATE enlaces SET usuario_id = $1 WHERE usuario_id IS NULL', [usuario.id]);
    } catch (e) {
        console.error('Error al preparar la base de datos:', e);
    }
}

async function asegurarUsuarioPrincipal() {
    const usuarioActual = await pool.query('SELECT * FROM usuarios WHERE username = $1', [DEFAULT_ADMIN_USER]);
    if (usuarioActual.rows[0]) return usuarioActual.rows[0];

    const passwordHash = crearHashPassword(DEFAULT_ADMIN_PASSWORD);
    const nuevoUsuario = await pool.query(
        `INSERT INTO usuarios (username, password_hash, slug, nombre_publico, descripcion)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [DEFAULT_ADMIN_USER, passwordHash, DEFAULT_SLUG, DEFAULT_PUBLIC_NAME, DEFAULT_PUBLIC_DESCRIPTION]
    );
    return nuevoUsuario.rows[0];
}

inicializarBaseDatos();

const seguridadAdmin = basicAuth({
    authorizer: async (username, password, cb) => {
        try {
            const resultado = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
            const usuario = resultado.rows[0];
            cb(null, Boolean(usuario && comprobarPassword(password, usuario.password_hash)));
        } catch (e) {
            cb(null, false);
        }
    },
    authorizeAsync: true,
    challenge: true,
    realm: 'Panel Privado'
});

async function cargarUsuarioAdmin(req, res, next) {
    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE username = $1', [req.auth.user]);
        if (!resultado.rows[0]) return res.status(401).send('Usuario no encontrado');
        req.usuario = resultado.rows[0];
        next();
    } catch (e) {
        res.status(500).send('No se pudo cargar el usuario');
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads', req.usuario.slug);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'perfil' + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, file.mimetype.startsWith('image/'));
    }
});

async function obtenerUsuarioPublico(slugSolicitado) {
    const slug = limpiarSlug(slugSolicitado || DEFAULT_SLUG);
    const resultado = await pool.query(
        'SELECT id, slug, nombre_publico, descripcion FROM usuarios WHERE slug = $1',
        [slug]
    );
    return resultado.rows[0];
}

function obtenerFotoPerfil(slug) {
    const dir = path.join(__dirname, 'public', 'uploads', slug);
    if (!fs.existsSync(dir)) return { existe: false };
    const foto = fs.readdirSync(dir).find((f) => f.startsWith('perfil'));
    return foto ? { existe: true, url: `/uploads/${slug}/${foto}` } : { existe: false };
}

app.get('/admin', seguridadAdmin, cargarUsuarioAdmin, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'admin.html'));
});

app.get('/api/admin/perfil', seguridadAdmin, cargarUsuarioAdmin, (req, res) => {
    res.json({
        slug: req.usuario.slug,
        nombre_publico: req.usuario.nombre_publico,
        descripcion: req.usuario.descripcion,
        foto: obtenerFotoPerfil(req.usuario.slug)
    });
});

app.get('/api/admin/enlaces', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    const resBD = await pool.query(
        'SELECT id, titulo, url, posicion FROM enlaces WHERE usuario_id = $1 ORDER BY posicion ASC, id ASC',
        [req.usuario.id]
    );
    res.json(resBD.rows);
});

app.post('/api/admin/perfil', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    const nombre = String(req.body.nombre_publico || '').trim();
    const descripcion = String(req.body.descripcion || '').trim();
    if (!nombre) return res.redirect('/admin');

    await pool.query(
        'UPDATE usuarios SET nombre_publico = $1, descripcion = $2 WHERE id = $3',
        [nombre, descripcion, req.usuario.id]
    );
    res.redirect('/admin');
});

app.post('/api/admin/usuarios', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    const username = limpiarSlug(req.body.username);
    const password = String(req.body.password || '').trim();
    const slug = limpiarSlug(req.body.slug || username);
    const nombre = String(req.body.nombre_publico || '').trim();
    const descripcion = String(req.body.descripcion || '').trim();

    if (!username || !password || !slug || !nombre) return res.redirect('/admin?usuario=error');

    try {
        await pool.query(
            `INSERT INTO usuarios (username, password_hash, slug, nombre_publico, descripcion)
             VALUES ($1, $2, $3, $4, $5)`,
            [username, crearHashPassword(password), slug, nombre, descripcion]
        );
        res.redirect('/admin?usuario=creado');
    } catch (e) {
        console.error('No se pudo crear el usuario:', e.message);
        res.redirect('/admin?usuario=duplicado');
    }
});

app.get('/api/enlaces', async (req, res) => {
    const usuario = await obtenerUsuarioPublico(req.query.usuario || DEFAULT_SLUG);
    if (!usuario) return res.status(404).json([]);

    const resBD = await pool.query(
        'SELECT id, titulo, url, posicion FROM enlaces WHERE usuario_id = $1 ORDER BY posicion ASC, id ASC',
        [usuario.id]
    );
    res.json(resBD.rows);
});

app.get('/api/perfil', async (req, res) => {
    const usuario = await obtenerUsuarioPublico(req.query.usuario || DEFAULT_SLUG);
    if (!usuario) return res.status(404).json({ existe: false });

    res.json({
        ...usuario,
        foto: obtenerFotoPerfil(usuario.slug)
    });
});

app.post('/api/enlaces', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    const titulo = String(req.body.titulo || '').trim();
    const url = String(req.body.url || '').trim();
    const posicion = Number.parseInt(req.body.posicion, 10) || 0;
    if (!titulo || !url) return res.redirect('/admin');

    await pool.query(
        'INSERT INTO enlaces (usuario_id, titulo, url, posicion) VALUES ($1, $2, $3, $4)',
        [req.usuario.id, titulo, url, posicion]
    );
    res.redirect('/admin');
});

app.post('/api/ordenar-enlaces', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    const posiciones = req.body.posiciones || {};
    for (const [id, pos] of Object.entries(posiciones)) {
        await pool.query(
            'UPDATE enlaces SET posicion = $1 WHERE id = $2 AND usuario_id = $3',
            [pos, id, req.usuario.id]
        );
    }
    res.json({ success: true });
});

app.post('/api/eliminar-enlace', seguridadAdmin, cargarUsuarioAdmin, async (req, res) => {
    await pool.query('DELETE FROM enlaces WHERE id = $1 AND usuario_id = $2', [req.body.id, req.usuario.id]);
    res.redirect('/admin');
});

app.post('/api/perfil/subir', seguridadAdmin, cargarUsuarioAdmin, upload.single('imagenPerfil'), (req, res) => {
    res.redirect('/admin');
});

app.post('/api/perfil/eliminar', seguridadAdmin, cargarUsuarioAdmin, (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads', req.usuario.slug);
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((file) => {
            if (file.startsWith('perfil')) fs.unlinkSync(path.join(dir, file));
        });
    }
    res.redirect('/admin');
});

app.get('/u/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
