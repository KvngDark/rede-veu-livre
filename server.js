const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const socketIo = require('socket.io');
const http = require('http');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'rpg_secret_key_2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Conexão com TiDB Cloud
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'rede_veu_livre',
    port: 4000,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao TiDB:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao TiDB Cloud com sucesso!');
});

// ============ SOCKET.IO - CHAT ============
io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username) {
        return next(new Error("Usuário não autenticado"));
    }
    socket.username = username;
    next();
});

io.on('connection', (socket) => {
    console.log(`📡 Usuário conectado: ${socket.username}`);
    
    // Enviar histórico
    db.query('SELECT sender, message, timestamp FROM chat_messages ORDER BY timestamp DESC LIMIT 50', 
        (err, results) => {
            if (!err && results) {
                socket.emit('chat history', results.reverse());
            }
        }
    );
    
    socket.broadcast.emit('user joined', `${socket.username} entrou no chat`);
    
    socket.on('chat message', (data) => {
        const message = {
            sender: socket.username,
            message: data.message,
            timestamp: new Date()
        };
        
        db.query('INSERT INTO chat_messages (sender, message) VALUES (?, ?)',
            [socket.username, data.message], (err) => {
                if (!err) {
                    io.emit('chat message', message);
                }
            }
        );
    });
    
    socket.on('disconnect', () => {
        io.emit('user left', `${socket.username} saiu do chat`);
    });
});

// ============ ROTAS DA API ============

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        
        const valid = await bcrypt.compare(password, results[0].password);
        if (valid) {
            req.session.user = username;
            res.json({ success: true, username });
        } else {
            res.status(401).json({ error: 'Senha incorreta' });
        }
    });
});

// Registro
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.query('INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword], (err) => {
            if (err) {
                return res.status(400).json({ error: 'Usuário já existe' });
            }
            res.json({ success: true });
        });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Posts do fórum
app.get('/api/posts', (req, res) => {
    db.query('SELECT * FROM forum_posts WHERE deleted = FALSE ORDER BY CASE WHEN type = "ajuda" THEN 0 ELSE 1 END, created_at DESC',
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
});

app.post('/api/posts', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Não logado' });
    
    const { type, title, content } = req.body;
    db.query('INSERT INTO forum_posts (type, title, author, content) VALUES (?, ?, ?, ?)',
        [type, title, req.session.user, content], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Comentários
app.get('/api/comments/:postId', (req, res) => {
    db.query('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC',
        [req.params.postId], (err, results) => {
            res.json(results || []);
        });
});

app.post('/api/comments', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Não logado' });
    
    const { postId, content } = req.body;
    db.query('INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)',
        [postId, req.session.user, content], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Desaparecidos
app.get('/api/missing', (req, res) => {
    db.query('SELECT * FROM missing_persons ORDER BY created_at DESC', (err, results) => {
        res.json(results || []);
    });
});

app.post('/api/missing', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Não logado' });
    
    const { name, age, location, description } = req.body;
    db.query('INSERT INTO missing_persons (name, age, location, description, created_by) VALUES (?, ?, ?, ?, ?)',
        [name, age, location, description, req.session.user], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Estados
app.get('/api/states', (req, res) => {
    db.query('SELECT * FROM states_info', (err, results) => {
        res.json(results || []);
    });
});

app.get('/api/state/:uf', (req, res) => {
    db.query('SELECT * FROM states_info WHERE uf = ?', [req.params.uf], (err, results) => {
        res.json(results[0] || {});
    });
});

// Servir frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
