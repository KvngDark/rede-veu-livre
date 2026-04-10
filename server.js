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

// Configuração do Socket.IO para funcionar no Render
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    httpCompression: false
});

// Middleware
app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'rpg_secret_key_2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Middleware para logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Conexão com TiDB Cloud
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'rede_veu_livre',
    port: 4000,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 30000,
    enableKeepAlive: true
});

db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao TiDB:', err.message);
        setTimeout(() => {
            console.log('Tentando reconectar...');
            db.connect();
        }, 5000);
        return;
    }
    console.log('Conectado ao TiDB Cloud com sucesso!');
    criarTabelas();
});

// Keep connection alive
setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.log('Keepalive query failed');
    });
}, 30000);

function criarTabelas() {
    const sqlTables = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            character_name VARCHAR(100),
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            is_private BOOLEAN DEFAULT FALSE,
            recipient VARCHAR(50),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS forum_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('alerta', 'discussao', 'relato', 'ajuda') NOT NULL,
            title VARCHAR(200) NOT NULL,
            author VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id INT NOT NULL,
            author VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS missing_persons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            age INT,
            location VARCHAR(200),
            description TEXT,
            status VARCHAR(50) DEFAULT 'Desaparecido',
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS states_info (
            uf CHAR(2) PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            population VARCHAR(50),
            status TEXT,
            \`groups\` TEXT,
            safety VARCHAR(20),
            recommendation TEXT
        );
        
        CREATE TABLE IF NOT EXISTS private_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            from_user VARCHAR(50) NOT NULL,
            to_user VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_users (from_user, to_user),
            INDEX idx_recipient (to_user, is_read)
        );
    `;
    
    db.query(sqlTables, (err) => {
        if (err) {
            console.error('Erro ao criar tabelas:', err);
        } else {
            console.log('Tabelas criadas/verificadas');
            criarAdmin();
            criarEstadosIniciais();
        }
    });
}

function criarAdmin() {
    db.query('SELECT * FROM users WHERE username = ?', ['RianGomes'], async (err, results) => {
        const hash = await bcrypt.hash('Luiza1908', 10);
        
        if (results && results.length > 0) {
            db.query('UPDATE users SET password = ?, is_admin = TRUE, character_name = ? WHERE username = ?',
                [hash, 'Rian Gomes - Fundador', 'RianGomes'], (err) => {
                    if (!err) console.log('Admin RianGomes atualizado');
                });
        } else {
            db.query('INSERT INTO users (username, password, character_name, is_admin) VALUES (?, ?, ?, ?)',
                ['RianGomes', hash, 'Rian Gomes - Fundador', true], (err) => {
                    if (!err) console.log('Admin RianGomes criado');
                });
        }
    });
}

function criarEstadosIniciais() {
    const estados = [
        ['SP', 'Sao Paulo', '~46.649.130', 'Megacidade com alta atividade anormal', 'ONG "Maos Dadas" controla o caos', 'Alta', 'O Santuario na Liberdade oferece protecao completa'],
        ['RJ', 'Rio de Janeiro', '~17.463.350', 'Caos urbano com faccoes se difundindo', 'Faccoes dominam todo o estado', 'Baixa', 'Evite areas de risco, Zona Sul e mais segura'],
        ['MG', 'Minas Gerais', '~21.411.920', 'Locais historicos sendo alvos de grupos', 'Grupo "O Olho" domina a regiao', 'Media', 'Belo Horizonte e relativamente segura'],
        ['RS', 'Rio Grande do Sul', '~11.466.630', 'Pampas com matilhas gauchas', 'Lobisomens dominam Porto Alegre', 'Alta', 'Evite noites de lua cheia'],
        ['BA', 'Bahia', '~14.985.280', 'Litoral e interior em alerta', 'Misticos do Candomble dominam Salvador', 'Media', 'Evite cemiterios'],
        ['PE', 'Pernambuco', '~9.674.790', 'Area costeira irregular', '"Transtornados" andam por Recife', 'Baixa', 'Nao ande sozinho'],
        ['AM', 'Amazonas', '~4.270.000', 'Alta atividade na selva', 'Tribos indigenas em purificacao', 'Baixa', 'Nao entre na floresta sem guias'],
        ['DF', 'Distrito Federal', '~3.094.330', 'Sede do governo', 'Governo controla a regiao', 'Alta', 'Entrada permitida apenas para cidadaos']
    ];
    
    estados.forEach(e => {
        db.query('INSERT IGNORE INTO states_info (uf, name, population, status, `groups`, safety, recommendation) VALUES (?, ?, ?, ?, ?, ?, ?)', e);
    });
}

// ============ SOCKET.IO - CHAT PUBLICO E PRIVADO ============
io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username) {
        return next(new Error("Usuario nao autenticado"));
    }
    socket.username = username;
    next();
});

io.on('connection', (socket) => {
    console.log(`Conectado: ${socket.username}`);
    
    // Carregar histórico do chat público
    db.query('SELECT sender, message, timestamp FROM chat_messages WHERE is_private = FALSE OR is_private IS NULL ORDER BY timestamp DESC LIMIT 50', 
        (err, results) => {
            if (!err && results) {
                socket.emit('chat history', results.reverse());
            }
        }
    );
    
    socket.broadcast.emit('user joined', `${socket.username} entrou no chat`);
    
    // Mensagem pública
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
            });
    });
    
    // Mensagem privada
    socket.on('private message', (data) => {
        const { to, message } = data;
        
        db.query('INSERT INTO private_messages (from_user, to_user, message) VALUES (?, ?, ?)',
            [socket.username, to, message], (err) => {
                if (!err) {
                    io.to(to).emit('private message received', {
                        from: socket.username,
                        message: message,
                        timestamp: new Date()
                    });
                    socket.emit('private message sent', { to, message });
                }
            });
    });
    
    // Carregar mensagens privadas
    socket.on('load private messages', (data, callback) => {
        const { withUser } = data;
        
        db.query(`SELECT * FROM private_messages 
                  WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
                  ORDER BY created_at ASC`,
            [socket.username, withUser, withUser, socket.username], 
            (err, results) => {
                if (callback) callback(results || []);
            });
    });
    
    socket.on('disconnect', () => {
        io.emit('user left', `${socket.username} saiu do chat`);
    });
});

// ============ ROTAS DA API ============

// Listar todos os usuários
app.get('/api/users', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nao logado' });
    
    db.query('SELECT username, character_name, is_admin FROM users WHERE username != ? ORDER BY username', 
        [req.session.user], (err, results) => {
            res.json(results || []);
        });
});

// Verificar se usuário é admin
app.get('/api/isAdmin', (req, res) => {
    if (!req.session.user) return res.json({ isAdmin: false });
    
    db.query('SELECT is_admin FROM users WHERE username = ?', [req.session.user], (err, results) => {
        res.json({ isAdmin: results && results[0]?.is_admin || false });
    });
});

// Tornar outro usuário admin
app.post('/api/makeAdmin', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nao logado' });
    
    db.query('SELECT is_admin FROM users WHERE username = ?', [req.session.user], (err, results) => {
        if (err || !results[0]?.is_admin) {
            return res.status(403).json({ error: 'Apenas administradores podem fazer isso' });
        }
        
        const { username } = req.body;
        db.query('UPDATE users SET is_admin = TRUE WHERE username = ?', [username], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Usuario nao encontrado' });
        }
        
        const valid = await bcrypt.compare(password, results[0].password);
        if (valid) {
            req.session.user = username;
            res.json({ success: true, username, isAdmin: results[0].is_admin });
        } else {
            res.status(401).json({ error: 'Senha incorreta' });
        }
    });
});

// Registro
app.post('/api/register', async (req, res) => {
    const { username, password, adminCode } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Usuario deve ter pelo menos 3 caracteres' });
    }
    
    if (password.length < 4) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres' });
    }
    
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro no servidor' });
        }
        
        if (results && results.length > 0) {
            return res.status(400).json({ error: `Usuario "${username}" ja existe!` });
        }
        
        const isAdmin = (adminCode === 'ADMIN2024');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.query('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
            [username, hashedPassword, isAdmin], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao criar usuario' });
                }
                
                res.json({ 
                    success: true, 
                    isAdmin: isAdmin,
                    message: isAdmin ? 'Admin criado com sucesso!' : 'Usuario criado com sucesso!'
                });
            });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Listar posts
app.get('/api/posts', (req, res) => {
    db.query(`SELECT * FROM forum_posts WHERE deleted = FALSE 
              ORDER BY CASE WHEN type = 'ajuda' THEN 0 ELSE 1 END, created_at DESC`, 
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
});

// Criar post
app.post('/api/posts', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Faca login primeiro' });
    }
    
    const { type, title, content } = req.body;
    
    if (!type || !title || !content) {
        return res.status(400).json({ error: 'Preencha todos os campos' });
    }
    
    db.query('INSERT INTO forum_posts (type, title, author, content) VALUES (?, ?, ?, ?)',
        [type, title, req.session.user, content], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao criar post' });
            }
            res.json({ success: true, postId: result.insertId });
        });
});

// Deletar post (apenas admin)
app.delete('/api/posts/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nao logado' });
    
    db.query('SELECT is_admin FROM users WHERE username = ?', [req.session.user], (err, results) => {
        if (err || !results[0]?.is_admin) {
            return res.status(403).json({ error: 'Apenas administradores podem deletar posts' });
        }
        
        db.query('UPDATE forum_posts SET deleted = TRUE WHERE id = ?',
            [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    });
});

// Deletar desaparecido (apenas admin)
app.delete('/api/missing/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nao logado' });
    
    db.query('SELECT is_admin FROM users WHERE username = ?', [req.session.user], (err, results) => {
        if (err || !results[0]?.is_admin) {
            return res.status(403).json({ error: 'Apenas administradores podem deletar' });
        }
        
        db.query('DELETE FROM missing_persons WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
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
    if (!req.session.user) {
        return res.status(401).json({ error: 'Faca login primeiro' });
    }
    
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
    if (!req.session.user) return res.status(401).json({ error: 'Nao logado' });
    
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

app.get('/api/session', (req, res) => {
    if (!req.session.user) {
        return res.json({ user: null });
    }
    
    db.query('SELECT username, is_admin FROM users WHERE username = ?', [req.session.user], (err, results) => {
        res.json({ 
            user: req.session.user,
            isAdmin: results && results[0]?.is_admin || false
        });
    });
});

// Servir frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
