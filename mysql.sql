-- Crie um banco de dados chamado 'rpg_campaign'
CREATE DATABASE rpg_campaign;
USE rpg_campaign;

-- Tabela de usuários
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    character_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de mensagens do chat
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
);

-- Tabela de posts do fórum
CREATE TABLE forum_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('alerta', 'discussao', 'relato', 'ajuda') NOT NULL,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de comentários
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    author VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
);

-- Tabela de desaparecidos
CREATE TABLE missing_persons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    location VARCHAR(200),
    description TEXT,
    status VARCHAR(50) DEFAULT 'Desaparecido',
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de avistamentos
CREATE TABLE sightings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    missing_id INT NOT NULL,
    reporter VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (missing_id) REFERENCES missing_persons(id) ON DELETE CASCADE
);

-- Inserir dados iniciais dos estados
CREATE TABLE states_info (
    uf CHAR(2) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    population VARCHAR(50),
    status TEXT,
    groups TEXT,
    safety VARCHAR(20),
    recommendation TEXT
);

-- Inserir informações dos estados (exemplo para alguns)
INSERT INTO states_info VALUES 
('SP', 'São Paulo', '~46.649.130', 'Megacidade com alta atividade anormal', 'Ong "Mãos Dadas" controla o caos', 'Alta', 'O Santuário na Liberdade oferece proteção completa'),
('RJ', 'Rio de Janeiro', '~17.463.350', 'Caos urbano com facções se difundindo', 'Facções dominam todo o estado', 'Baixa', 'Evite áreas de risco, Zona Sul é mais segura'),
('MG', 'Minas Gerais', '~21.411.920', 'Locais históricos sendo alvos de grupos', 'Grupo "O Olho" domina a região', 'Média', 'Belo Horizonte é relativamente segura');
-- Adicione os outros estados similarmente