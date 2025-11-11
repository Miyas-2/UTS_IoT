const pool = require('../config/db.config');

class SensorModel {
    // Check if humidity column exists
    async checkHumidityColumn() {
        try {
            const [rows] = await pool.execute(`DESCRIBE data_sensor`);
            return rows.some(row => row.Field === 'humidity');
        } catch (error) {
            console.error('Error checking column:', error);
            return false;
        }
    }

    // Simpan data dengan humidity (tidak berubah)
    async saveData(suhu, humidity, lux, timestamp) {
        const hasHumidity = await this.checkHumidityColumn();

        let query, params;
        if (hasHumidity) {
            query = `INSERT INTO data_sensor (suhu, humidity, lux, timestamp) VALUES (?, ?, ?, ?)`;
            params = [suhu, humidity, lux, timestamp];
        } else {
            query = `INSERT INTO data_sensor (suhu, lux, timestamp) VALUES (?, ?, ?)`;
            params = [suhu, lux, timestamp];
            console.warn('Humidity column not found, saving without humidity data');
        }

        try {
            const result = await pool.execute(query, params);
            console.log(`Data saved to DB - ID: ${result[0].insertId}, Suhu: ${suhu}°C${hasHumidity ? `, Humidity: ${humidity}%` : ''}, LDR: ${lux}`);
            return result[0].insertId;
        } catch (error) {
            console.error('Error saving data to database:', error);
            throw error;
        }
    }

    // Get history data (FIXED - use pool.query instead of pool.execute for LIMIT)
    async getHistory(limit = 100) {
        const limitInt = parseInt(limit, 10);
        const validLimits = [10, 50, 100];
        const finalLimit = validLimits.includes(limitInt) ? limitInt : 100;

        console.log(`getHistory called with limit: ${limit} (type: ${typeof limit}), parsed: ${limitInt}, final: ${finalLimit}`);

        // Check if humidity column exists
        const hasHumidity = await this.checkHumidityColumn();

        let query;
        if (hasHumidity) {
            // FIXED: Use string interpolation instead of parameter for LIMIT
            query = `SELECT id, suhu, humidity, lux, timestamp FROM data_sensor ORDER BY timestamp DESC LIMIT ${finalLimit}`;
        } else {
            query = `SELECT id, suhu, lux, timestamp FROM data_sensor ORDER BY timestamp DESC LIMIT ${finalLimit}`;
        }

        try {
            // FIXED: Use pool.query() without parameters for LIMIT clause
            const [rows] = await pool.query(query);
            console.log(`Retrieved ${rows.length} records from database (with${hasHumidity ? '' : 'out'} humidity)`);

            // Add humidity: null for backward compatibility if column doesn't exist
            if (!hasHumidity) {
                return rows.map(row => ({ ...row, humidity: null }));
            }

            return rows;
        } catch (error) {
            console.error('Error fetching history data:', error);
            console.error('Query:', query);
            throw error;
        }
    }

    // Get all data (FIXED - use pool.query)
    async getAllData() {
        const hasHumidity = await this.checkHumidityColumn();

        let query;
        if (hasHumidity) {
            query = `SELECT id, suhu, humidity, lux, timestamp FROM data_sensor ORDER BY timestamp DESC`;
        } else {
            query = `SELECT id, suhu, lux, timestamp FROM data_sensor ORDER BY timestamp DESC`;
        }

        try {
            const [rows] = await pool.query(query);
            console.log(`Retrieved all ${rows.length} records from database`);

            // Add humidity: null for backward compatibility
            if (!hasHumidity) {
                return rows.map(row => ({ ...row, humidity: null }));
            }

            return rows;
        } catch (error) {
            console.error('Error fetching all data:', error);
            throw error;
        }
    }

    // Get data by ID (keep using pool.execute for WHERE clause)
    async getDataById(id) {
        const hasHumidity = await this.checkHumidityColumn();

        let query;
        if (hasHumidity) {
            query = `SELECT id, suhu, humidity, lux, timestamp FROM data_sensor WHERE id = ?`;
        } else {
            query = `SELECT id, suhu, lux, timestamp FROM data_sensor WHERE id = ?`;
        }

        try {
            const idInt = parseInt(id, 10);
            const [rows] = await pool.execute(query, [idInt]);

            if (rows.length > 0) {
                const result = rows[0];
                if (!hasHumidity) {
                    result.humidity = null;
                }
                return result;
            }
            return null;
        } catch (error) {
            console.error('Error fetching data by ID:', error);
            throw error;
        }
    }

    // Get data count (FIXED - use pool.query)
    async getDataCount() {
        const query = `SELECT COUNT(*) as count FROM data_sensor`;

        try {
            const [rows] = await pool.query(query);
            return rows[0].count;
        } catch (error) {
            console.error('Error getting data count:', error);
            throw error;
        }
    }

    // Reset all data (keep using pool.execute for DELETE)
    async resetAllData() {
        try {
            const [result] = await pool.execute(`DELETE FROM data_sensor`);
            await pool.execute(`ALTER TABLE data_sensor AUTO_INCREMENT = 1`);

            return {
                success: true,
                message: 'All sensor data has been reset',
                deletedRows: result.affectedRows
            };
        } catch (error) {
            console.error('Error resetting data:', error);
            throw error;
        }
    }

    // Get latest sensor readings (FIXED - use LIMIT 1 with string interpolation)
    async getLatestData() {
        const hasHumidity = await this.checkHumidityColumn();

        let query;
        if (hasHumidity) {
            query = `SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1`;
        } else {
            query = `SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1`;
        }

        try {
            const [rows] = await pool.query(query);
            if (rows.length > 0) {
                const result = rows[0];
                if (!hasHumidity) {
                    result.humidity = null;
                }
                return result;
            }
            return null;
        } catch (error) {
            console.error('Error fetching latest data:', error);
            throw error;
        }
    }

    // Get statistics (FIXED - use pool.query)
    async getStatistics() {
        const hasHumidity = await this.checkHumidityColumn();

        let query;
        if (hasHumidity) {
            query = `
                SELECT 
                    MIN(suhu) as min_suhu, MAX(suhu) as max_suhu, AVG(suhu) as avg_suhu,
                    MIN(humidity) as min_humidity, MAX(humidity) as max_humidity, AVG(humidity) as avg_humidity,
                    MIN(lux) as min_lux, MAX(lux) as max_lux, AVG(lux) as avg_lux,
                    COUNT(*) as total_records
                FROM data_sensor
            `;
        } else {
            query = `
                SELECT 
                    MIN(suhu) as min_suhu, MAX(suhu) as max_suhu, AVG(suhu) as avg_suhu,
                    NULL as min_humidity, NULL as max_humidity, NULL as avg_humidity,
                    MIN(lux) as min_lux, MAX(lux) as max_lux, AVG(lux) as avg_lux,
                    COUNT(*) as total_records
                FROM data_sensor
            `;
        }

        try {
            const [rows] = await pool.query(query);
            return rows[0];
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw error;
        }
    }

    async getHumidityStats() {
        const hasHumidity = await this.checkHumidityColumn();

        if (!hasHumidity) {
            return {
                min_humidity: null,
                max_humidity: null,
                avg_humidity: null,
                total_records: 0,
                message: 'Humidity column not found in database'
            };
        }

        const query = `
            SELECT 
                MIN(humidity) as min_humidity,
                MAX(humidity) as max_humidity,
                AVG(humidity) as avg_humidity,
                COUNT(*) as total_records
            FROM data_sensor 
            WHERE humidity IS NOT NULL
        `;

        try {
            const [rows] = await pool.query(query);
            const result = rows[0];

            // Format the results
            return {
                min_humidity: result.min_humidity ? parseFloat(result.min_humidity).toFixed(2) : null,
                max_humidity: result.max_humidity ? parseFloat(result.max_humidity).toFixed(2) : null,
                avg_humidity: result.avg_humidity ? parseFloat(result.avg_humidity).toFixed(2) : null,
                total_records: result.total_records || 0
            };
        } catch (error) {
            console.error('Error fetching humidity statistics:', error);
            throw error;
        }
    }
}

module.exports = new SensorModel();