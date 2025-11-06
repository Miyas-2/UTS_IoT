// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const db = require('./config/db.config'); 
const sensorModel = require('./models/sensor.model'); 
const controlRoutes = require('./controllers/control.controller'); // Import router control

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

// --- KONFIGURASI TIMER PENYIMPANAN ---
const STORAGE_INTERVAL = 20000; // Simpan ke MySQL setiap 20 detik

// Middleware
app.use(express.static('public')); // Melayani file frontend dari folder 'public'
app.use(express.json()); // Parsing JSON body dari request

// --- Konfigurasi MQTT ---
const MQTT_BROKER = 'mqtt://broker.mqtt.cool:1883';
const TOPIC_SENSOR_TEMP = 'uts/iot/sensor/temperature_c';
const TOPIC_SENSOR_LDR = 'uts/iot/sensor/ldr';
const TOPIC_CONTROL_LED = 'uts/iot/control_led'; // Untuk publish perintah

const client  = mqtt.connect(MQTT_BROKER);

// Data Real-time dan Buffer Agregasi (global)
let realtimeData = {
    suhu: null,
    lux: null,
    relayStatus: 'OFF'
};

client.on('connect', function () {
    console.log('MQTT Connected to broker.mqtt.cool');
    
    // Subscribe ke semua topik sensor, termasuk status relay
    const topics = [TOPIC_SENSOR_TEMP, TOPIC_SENSOR_LDR, 'uts/iot/status/relay'];
    client.subscribe(topics, function (err) {
        if (!err) {
            console.log(`Subscribed to: ${topics.join(', ')}`);
        }
    });
});

client.on('message', async function (topic, message) {
    const payload = message.toString();
    const timestamp = new Date(); 

    try {
        if (topic === TOPIC_SENSOR_TEMP) {
            realtimeData.suhu = parseFloat(payload);
        } else if (topic === TOPIC_SENSOR_LDR) {
            realtimeData.lux = parseInt(payload);
        } else if (topic === 'uts/iot/status/relay') {
            realtimeData.relayStatus = payload;
        }

        // --- Kirim ke Frontend (Real-Time) ---
        // Kirim update terbaru ke klien web, terlepas dari status agregasi
        io.emit('realtime_update', { 
            suhu: realtimeData.suhu, 
            lux: realtimeData.lux, 
            relayStatus: realtimeData.relayStatus,
            timestamp: timestamp.toISOString()
        });

    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

// --- TIMER PENYIMPANAN KE DATABASE ---
setInterval(async () => {
    // Hanya simpan jika kedua nilai sudah pernah diterima
    if (realtimeData.suhu !== null && realtimeData.lux !== null) {
        
        const timestamp = new Date();
        
        try {
            // Menggunakan nilai terakhir yang diterima
            await sensorModel.saveData(realtimeData.suhu, realtimeData.lux, timestamp);
            console.log(`[DB SAVE] Data saved successfully at ${timestamp.toLocaleTimeString()}.`);
            
        } catch (error) {
            console.error('[DB SAVE ERROR] Failed to save data to MySQL:', error);
        }
    } else {
        console.log(`[DB SAVE] Waiting for complete data (Suhu: ${realtimeData.suhu}, Lux: ${realtimeData.lux})`);
    }
}, STORAGE_INTERVAL);

// --- Konfigurasi Socket.IO ---
io.on('connection', (socket) => {
    console.log('New client connected via Socket.IO');
    // Kirim data saat ini ke klien baru saat terhubung
    socket.emit('realtime_update', {
        suhu: realtimeData.suhu,
        lux: realtimeData.lux,
        relayStatus: realtimeData.relayStatus,
        timestamp: new Date().toISOString()
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// --- RUTE API ---

// Middleware untuk menambahkan klien MQTT ke request (untuk API Kontrol)
app.use((req, res, next) => {
    req.mqttClient = client;
    req.TOPIC_CONTROL_LED = TOPIC_CONTROL_LED;
    next();
});

// Gunakan rute kontrol (POST /api/control/led)
app.use('/api/control', controlRoutes);

// GET data historis dengan parameter limit
app.get('/api/history', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const data = await sensorModel.getHistory(limit);
        const total = await sensorModel.getDataCount();
        
        res.json({
            success: true,
            count: data.length,
            total: total,
            limit: parseInt(limit),
            data: data
        });
    } catch (error) {
        console.error('Error fetching history data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch history data',
            error: error.message 
        });
    }
});

// GET semua data
app.get('/api/data', async (req, res) => {
    try {
        const data = await sensorModel.getAllData();
        const total = await sensorModel.getDataCount();
        
        res.json({ 
            success: true, 
            count: data.length, 
            total: total,
            data: data 
        });
    } catch (error) {
        console.error('API Error /api/data:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching all sensor data.",
            error: error.message 
        });
    }
});

// GET data berdasarkan ID
app.get('/api/data/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format." });
    }
    
    try {
        const data = await sensorModel.getDataById(id);
        if (data) {
            res.json({ success: true, data: data });
        } else {
            res.status(404).json({ success: false, message: `Data with ID ${id} not found.` });
        }
    } catch (error) {
        console.error(`API Error /api/data/${id}:`, error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching sensor data by ID.",
            error: error.message 
        });
    }
});

// Reset semua data
app.delete('/api/data/reset', async (req, res) => {
    try {
        const result = await sensorModel.resetAllData();
        res.json(result);
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to reset data',
            error: error.message 
        });
    }
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Data will be saved to MySQL every ${STORAGE_INTERVAL / 1000} seconds.`);
});