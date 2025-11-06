// controllers/control.controller.js (KODE KOREKSI)

const express = require('express');
const router = express.Router();

// Rute POST untuk mengontrol Relay/LED
router.post('/led', (req, res) => {
    const client = req.mqttClient;
    const TOPIC_CONTROL_LED = req.TOPIC_CONTROL_LED;
    
    // Nilai command akan berupa "ON" atau "OFF" dari body JSON
    const { command } = req.body; 

    // KOREKSI DI BAWAH: Pastikan command === 'ON' atau command === 'OFF'
    if (command === 'ON' || command === 'OFF') {
        // PUBLISH perintah ke Broker MQTT
        client.publish(TOPIC_CONTROL_LED, command, (err) => {
            if (err) {
                console.error('MQTT publish error:', err);
                return res.status(500).json({ success: false, message: 'Failed to publish MQTT command.' });
            }
            console.log(`Published command: ${command} to ${TOPIC_CONTROL_LED}`);
            res.json({ success: true, message: `LED command ${command} sent via MQTT.` });
        });
    } else {
        // Jika command bukan "ON" dan bukan "OFF"
        res.status(400).json({ success: false, message: 'Invalid command. Use "ON" or "OFF".' });
    }
});

module.exports = router;