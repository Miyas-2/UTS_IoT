const pool = require('../config/db.config');

const SensorModel = {
    // Fungsi untuk menyimpan data sensor ke tabel data_sensor
    async saveData(suhu, lux, timestamp) {
        const query = `INSERT INTO data_sensor (suhu, lux, timestamp) VALUES (?, ?, ?)`;
        
        try {
            const result = await pool.execute(query, [suhu, lux, timestamp]);
            return result[0].insertId;
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    },
    
    // Fungsi untuk mengambil data historis dengan opsi limit
    async getHistory(limit = 100) {
        // Validasi limit untuk keamanan
        const validLimits = [10, 50, 100];
        const safeLimit = validLimits.includes(parseInt(limit)) ? parseInt(limit) : 100;
        
        const query = `SELECT id, suhu, lux, timestamp FROM data_sensor ORDER BY id DESC LIMIT ${safeLimit}`;
        
        try {
            const [rows] = await pool.execute(query);
            return rows;
        } catch (error) {
            console.error('Error fetching history:', error);
            return [];
        }
    },
    
    // Fungsi untuk cek berapa total data di database
    async getDataCount() {
        const query = `SELECT COUNT(*) as total FROM data_sensor`;
        try {
            const [rows] = await pool.execute(query);
            return rows[0].total;
        } catch (error) {
            console.error('Error counting data:', error);
            return 0;
        }
    },
    
    // Fungsi untuk mengambil SEMUA data
    async getAllData() {
        const query = `SELECT id, suhu, lux, timestamp FROM data_sensor ORDER BY id DESC LIMIT 1000`; 
        try {
            const [rows] = await pool.execute(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllData:', error);
            throw error;
        }
    },
    
    // Fungsi untuk mengambil data berdasarkan ID
    async getDataById(id) {
        const query = `SELECT id, suhu, lux, timestamp FROM data_sensor WHERE id = ?`;
        try {
            const [rows] = await pool.execute(query, [id]);
            return rows.length ? rows[0] : null; 
        } catch (error) {
            console.error(`Error getting data by ID ${id}:`, error);
            throw error;
        }
    },

    // Method untuk reset semua data
    async resetAllData() {
        try {
            const query = 'TRUNCATE TABLE data_sensor';
            await pool.execute(query);
            console.log('All sensor data has been reset');
            return { success: true, message: 'Data reset successfully' };
        } catch (error) {
            console.error('Error resetting data:', error);
            throw error;
        }
    }
};

module.exports = SensorModel;