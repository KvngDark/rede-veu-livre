const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Configuração do banco (use as mesmas variáveis do seu .env)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'gateway01.us-east-1.tidbcloud.com',
    user: process.env.DB_USER || 'seu_usuario',
    password: process.env.DB_PASSWORD || 'sua_senha',
    database: 'rede_veu_livre',
    port: 4000,
    ssl: { rejectUnauthorized: false }
});

async function criarAdmin() {
    const username = 'RianGomes';
    const password = 'Luiza1908';
    
    // Gerar hash da senha
    const hash = await bcrypt.hash(password, 10);
    console.log('Hash gerado:', hash);
    
    // Deletar se existir
    await new Promise((resolve) => {
        db.query('DELETE FROM users WHERE username = ?', [username], (err) => {
            if (err) console.error('Erro ao deletar:', err);
            resolve();
        });
    });
    
    // Inserir admin
    db.query('INSERT INTO users (username, password, character_name) VALUES (?, ?, ?)',
        [username, hash, 'Rian Gomes - Líder da Resistência'], 
        (err, result) => {
            if (err) {
                console.error('❌ Erro ao criar admin:', err.message);
            } else {
                console.log('✅ Admin criado com sucesso!');
                console.log('   Usuário: RianGomes');
                console.log('   Senha: Luiza1908');
                console.log('   Hash:', hash);
            }
            process.exit();
        });
}

criarAdmin();
