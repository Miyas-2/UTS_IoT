// config/db.config.js

const mysql = require('mysql2/promise');

// Ganti dengan kredensial MySQL Anda
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Ganti!
    database: 'iot_db_uts' // Pastikan database ini sudah dibuat
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;