#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- 1. PIN Definitions ---
#define RELAY_PIN 13       // Pin Relay (Lamp/LED)
#define LDR_PIN 32         // Pin LDR (Analog Input)
#define ONE_WIRE_BUS 4     // Pin Data DS18B20 (GPIO 4 pada ESP32)

// --- 2. WiFi Configuration (GANTI dengan kredensial Anda) ---
const char* ssid = "test123"; 
const char* password = "qwerasdf"; 

// --- 3. MQTT Configuration ---
const char* mqtt_server = "broker.mqtt.cool"; 
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32_Temp_LDR_Relay_Client"; 

// Topik Publish
const char* topic_temp = "uts/iot/sensor/temperature_c"; // Suhu Celsius
const char* topic_ldr = "uts/iot/sensor/ldr";           // Nilai LDR
const char* topic_relay_status = "uts/iot/status/relay"; // Status Relay

// Topik Subscribe untuk kontrol Relay
const char* mqtt_topic_subscribe_led = "uts/iot/control_led"; 

// --- 4. Setup Objects ---
// DS18B20 Setup
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// MQTT Setup
WiFiClient espClient;
PubSubClient client(espClient);

// Timing (for reading sensors every 2 seconds)
const long interval = 2000;
long lastMeasure = 0;

// --- 5. Function Prototypes ---
void setup_wifi();
void reconnect_mqtt();
void callback_mqtt(char* topic, byte* payload, unsigned int length);
void publish_float_data(const char* topic, float value);
void publish_int_data(const char* topic, int value);
void publish_string_data(const char* topic, const char* value);


// --- 6. Implementation: WiFi dan MQTT Connection ---

void setup_wifi() {
    delay(10);
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
}

void reconnect_mqtt() {
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        if (client.connect(mqtt_client_id)) {
            Serial.println("connected");
            client.subscribe(mqtt_topic_subscribe_led);
            Serial.print("Subscribed to: ");
            Serial.println(mqtt_topic_subscribe_led);
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" trying again in 5 seconds");
            delay(5000);
        }
    }
}

// Fungsi CALLBACK: Mengontrol Relay berdasarkan perintah dari Flask/Broker
void callback_mqtt(char* topic, byte* payload, unsigned int length) {
    Serial.print("Perintah Masuk [");
    Serial.print(topic);
    Serial.print("] Payload: ");
    
    String messageTemp;
    for (int i = 0; i < length; i++) {
        messageTemp += (char)payload[i];
    }
    Serial.println(messageTemp);

    // --- Logika KONTROL Relay ---
    if (String(topic) == mqtt_topic_subscribe_led) {
        if (messageTemp == "ON") {
            digitalWrite(RELAY_PIN, HIGH);
            Serial.println(">>> RELAY ON (MANUAL MQTT) <<<");
        } else if (messageTemp == "OFF") {
            digitalWrite(RELAY_PIN, LOW);
            Serial.println(">>> RELAY OFF (MANUAL MQTT) <<<");
        }
        // Publish status terbaru Relay untuk feedback ke backend
        const char* relayStatusStr = digitalRead(RELAY_PIN) == HIGH ? "ON" : "OFF";
        publish_string_data(topic_relay_status, relayStatusStr);
    }
}

// Fungsi untuk publish nilai float (Suhu)
void publish_float_data(const char* topic, float value) {
    char payload[8]; 
    dtostrf(value, 4, 2, payload); // Konversi float ke string (2 desimal)
    
    if (!client.publish(topic, payload)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}

// Fungsi untuk publish nilai integer (LDR)
void publish_int_data(const char* topic, int value) {
    char payload[8]; 
    itoa(value, payload, 10); 
    
    if (!client.publish(topic, payload)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}

// Fungsi untuk publish nilai string (Status Relay)
void publish_string_data(const char* topic, const char* value) {
    if (!client.publish(topic, value)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}


// --- 7. Setup dan Loop Utama ---

void setup() {
    Serial.begin(9600);
    
    // Inisialisasi Sensor DS18B20
    sensors.begin();
    
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); 
    
    setup_wifi();
    
    // Konfigurasi MQTT Broker
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback_mqtt); 
    
    Serial.println("Sistem DS18B20, LDR, dan Relay Siap.");
}

void loop() {
    // Pastikan koneksi MQTT terjaga
    if (!client.connected()) {
        reconnect_mqtt();
    }
    client.loop(); // Memproses pesan masuk 

    long now = millis();

    // Jalankan pembacaan sensor dan publish setiap 2 detik
    if (now - lastMeasure >= interval) {
        lastMeasure = now;

        // --- 1. Baca Sensor DS18B20 (Suhu) ---
        sensors.requestTemperatures(); 
        // HANYA mengambil nilai Celsius
        float tempC = sensors.getTempCByIndex(0); 
        
        // --- 2. Baca Sensor LDR (Cahaya) ---
        int ldrValue = analogRead(LDR_PIN); 

        // --- 3. Publish Data ---
        if (client.connected()) {
            // Suhu
            if (tempC != DEVICE_DISCONNECTED_C) {
                // Publish hanya Celsius ke topik temperature_c
                publish_float_data(topic_temp, tempC); 
                Serial.print("Suhu Published: ");
                Serial.print(tempC);
                Serial.println(" ºC"); // Dicetak hanya dalam Celsius
            } else {
                Serial.println("Error: Could not read DS18B20");
            }

            // LDR
            publish_int_data(topic_ldr, ldrValue);
            Serial.print("LDR Published: ");
            Serial.println(ldrValue);
            
            // Status Relay
            const char* relayStatusStr = digitalRead(RELAY_PIN) == HIGH ? "ON" : "OFF";
            publish_string_data(topic_relay_status, relayStatusStr);
        }
        
        Serial.println("-------------------------------------");
    }
}