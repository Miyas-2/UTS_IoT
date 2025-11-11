// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const db = require('./config/db.config'); 
const sensorModel = require('./models/sensor.model'); 
const controlRoutes = require('./controllers/control.controller');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

// --- KONFIGURASI TIMER PENYIMPANAN ---
const STORAGE_INTERVAL = 20000; // Simpan ke MySQL setiap 20 detik

// Middleware
app.use(express.static('public'));
app.use(express.json());

// --- Konfigurasi MQTT (Updated untuk DHT22) ---
const MQTT_BROKER = 'mqtt://broker.mqtt.cool:1883';
const TOPIC_SENSOR_TEMP = 'uts/152023193/iot/sensor/temperature_c';
const TOPIC_SENSOR_HUMIDITY = 'uts/152023193/iot/sensor/humidity'; // ← BARU!
const TOPIC_SENSOR_LDR = 'uts/152023193/iot/sensor/ldr';

const TOPIC_CONTROL_LED = 'uts/152023193/iot/control_led';

const client = mqtt.connect(MQTT_BROKER);

// Data Real-time (Updated dengan humidity)
let realtimeData = {
    suhu: null,
    humidity: null,  // ← BARU!
    lux: null,
    relayStatus: 'OFF'
};

client.on('connect', function () {
    console.log('MQTT Connected to broker.mqtt.cool');
    
    // Subscribe ke semua topik sensor (Updated)
    const topics = [
        TOPIC_SENSOR_TEMP, 
        TOPIC_SENSOR_HUMIDITY,  // ← BARU!
        TOPIC_SENSOR_LDR, 
        'uts/152023193/iot/status/relay'
    ];
    
    client.subscribe(topics, function (err) {
        if (!err) {
            console.log(`Subscribed to: ${topics.join(', ')}`);
        }
    });
});

client.on('message', async function (topic, message) {
    const payload = message.toString();
    const timestamp = new Date(); 

    console.log(`MQTT Received - Topic: ${topic}, Payload: ${payload}`);

    try {
        if (topic === TOPIC_SENSOR_TEMP) {
            realtimeData.suhu = parseFloat(payload);
            console.log(`Temperature updated: ${realtimeData.suhu}°C`);
            
        } else if (topic === TOPIC_SENSOR_HUMIDITY) { // ← BARU!
            realtimeData.humidity = parseFloat(payload);
            console.log(`Humidity updated: ${realtimeData.humidity}%`);
            
        } else if (topic === TOPIC_SENSOR_LDR) {
            realtimeData.lux = parseInt(payload);
            console.log(`LDR updated: ${realtimeData.lux}`);
            
        } else if (topic === 'uts/152023193/iot/status/relay') {
            realtimeData.relayStatus = payload;
            console.log(`Relay status updated: ${realtimeData.relayStatus}`);
        }

        // --- Kirim ke Frontend (Real-Time) ---
        const socketData = { 
            suhu: realtimeData.suhu, 
            humidity: realtimeData.humidity,  // ← BARU!
            lux: realtimeData.lux, 
            relayStatus: realtimeData.relayStatus,
            timestamp: timestamp.toISOString()
        };
        
        console.log('Sending to frontend:', socketData);
        io.emit('realtime_update', socketData);

    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

// --- TIMER PENYIMPANAN KE DATABASE (Updated) ---
setInterval(async () => {
    // Hanya simpan jika semua nilai sudah diterima
    if (realtimeData.suhu !== null && realtimeData.humidity !== null && realtimeData.lux !== null) {
        
        const timestamp = new Date();
        
        try {
            // Simpan data dengan humidity
            await sensorModel.saveData(
                realtimeData.suhu, 
                realtimeData.humidity,  // ← BARU!
                realtimeData.lux, 
                timestamp
            );
            
            console.log(`[DB SAVE] Data saved successfully at ${timestamp.toLocaleTimeString()}`);
            console.log(`[DB SAVE] Suhu: ${realtimeData.suhu}°C, Humidity: ${realtimeData.humidity}%, LDR: ${realtimeData.lux}`);
            
        } catch (error) {
            console.error('[DB SAVE ERROR] Failed to save data to MySQL:', error);
        }
    } else {
        console.log(`[DB SAVE] Waiting for complete data - Suhu: ${realtimeData.suhu}, Humidity: ${realtimeData.humidity}, Lux: ${realtimeData.lux}`);
    }
}, STORAGE_INTERVAL);

// --- Konfigurasi Socket.IO (Updated) ---
io.on('connection', (socket) => {
    console.log('New client connected via Socket.IO');
    
    // Kirim data saat ini ke klien baru
    socket.emit('realtime_update', {
        suhu: realtimeData.suhu,
        humidity: realtimeData.humidity,  // ← BARU!
        lux: realtimeData.lux,
        relayStatus: realtimeData.relayStatus,
        timestamp: new Date().toISOString()
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// --- RUTE API ---
app.use((req, res, next) => {
    req.mqttClient = client;
    req.TOPIC_CONTROL_LED = TOPIC_CONTROL_LED;
    next();
});

app.use('/api/control', controlRoutes);
// API Routes (tidak berubah karena model akan handle struktur data)
app.get('/api/history', async (req, res) => {
    try {
        // Parse and validate limit parameter
        let limit = req.query.limit || 100;
        const limitInt = parseInt(limit, 10);
        
        // Validate limit is a valid number
        if (isNaN(limitInt) || limitInt <= 0) {
            limit = 100;
        } else {
            // Ensure it's one of valid options
            const validLimits = [10, 50, 100];
            limit = validLimits.includes(limitInt) ? limitInt : 100;
        }
        
        console.log(`📊 MANUAL HISTORY REQUEST - Limit: ${limit} records`); // New log
        
        const data = await sensorModel.getHistory(limit);
        const total = await sensorModel.getDataCount();
        
        console.log(`📊 HISTORY RESPONSE - Returned: ${data.length}/${total} records`); // New log
        
        res.json({
            success: true,
            count: data.length,
            total: total,
            limit: limit,
            data: data,
            requestTime: new Date().toISOString() // Add timestamp
        });
    } catch (error) {
        console.error('❌ HISTORY ERROR:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch history data',
            error: error.message 
        });
    }
});

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

app.get('/api/summary', async (req, res) => {
  console.log('Request diterima di /summary');
  try {
    // Menggunakan sensorModel untuk konsistensi
    const allData = await sensorModel.getAllData();
    console.log('Data dari database:', allData ? allData.length : 0, 'records');
    
    if (!allData || allData.length === 0) {
      console.log('Tidak ada data ditemukan');
      return res.json({
        suhumax: null,
        suhumin: null,
        suhurata: null,
        nilai_suhu_max_humid_max: [],
        month_year_max: []
      });
    }

    // Debug: cek struktur data pertama
    console.log('Sample data structure:', allData[0]);

    // Hitung agregat dari data dengan validasi
    const temperatures = allData
      .map(item => {
        // Coba berbagai kemungkinan nama field
        const temp = item.temp || item.temperature || item.suhu;
        return parseFloat(temp);
      })
      .filter(temp => !isNaN(temp) && temp !== null);

    console.log('Valid temperatures found:', temperatures.length);

    if (temperatures.length === 0) {
      return res.json({
        suhumax: null,
        suhumin: null,
        suhurata: null,
        nilai_suhu_max_humid_max: [],
        month_year_max: []
      });
    }

    const suhumax = Math.max(...temperatures);
    const suhumin = Math.min(...temperatures);
    const suhurata = Math.round((temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length) * 100) / 100;

    console.log(`Stats - Max: ${suhumax}, Min: ${suhumin}, Avg: ${suhurata}`);

    // Cari data dengan suhu maksimum
    const nilai_max = allData
      .filter(item => {
        const temp = item.temp || item.temperature || item.suhu;
        return parseFloat(temp) === suhumax;
      })
      .map(item => ({
        idx: item.id,
        suhu: item.temp || item.temperature || item.suhu,
        humid: item.hum || item.humidity || item.kelembaban,
        kecerahan: item.lux || item.light || item.kecerahan,
        timestamp: item.timestamp || item.created_at
      }));

    // Extract month-year dari data suhu maksimum
    const month_year = [...new Set(nilai_max.map(item => {
      try {
        const date = new Date(item.timestamp);
        if (isNaN(date.getTime())) {
          console.warn('Invalid timestamp:', item.timestamp);
          return null;
        }
        return `${date.getMonth() + 1}-${date.getFullYear()}`;
      } catch (error) {
        console.warn('Error parsing timestamp:', item.timestamp, error);
        return null;
      }
    }).filter(Boolean))].map(monthYear => ({ month_year: monthYear }));

    const responseJSON = {
      suhumax: suhumax,
      suhumin: suhumin,
      suhurata: suhurata,
      nilai_suhu_max_humid_max: nilai_max,
      month_year_max: month_year
    };

    console.log('Response JSON prepared successfully');
    res.json(responseJSON);

  } catch (e) {
    console.error(`Gagal membuat summary:`, e);
    console.error('Stack trace:', e.stack);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: e.message,
      details: 'Check server logs for more information'
    });
  }
});


server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Data will be saved to MySQL every ${STORAGE_INTERVAL / 1000} seconds.`);
    console.log('Monitoring DHT22 (Temperature + Humidity) and LDR sensors');
});