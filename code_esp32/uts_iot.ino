#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h> // Menggunakan library DHT
// Menghapus: #include <OneWire.h>
// Menghapus: #include <DallasTemperature.h>

// --- 1. PIN Definitions ---
#define RELAY_PIN 13       // Pin Relay (Lamp/LED)
#define LDR_PIN 32         // Pin LDR (Analog Input)
#define DHT_PIN 15       // Pin Data DHT (Menggantikan ONE_WIRE_BUS)
#define DHT_TYPE DHT22     // Tipe sensor DHT (Ganti ke DHT11 jika perlu)

// --- 2. WiFi Configuration (GANTI dengan kredensial Anda) ---
const char* ssid = "test123"; 
const char* password = "qwerasdf"; 

// --- 3. MQTT Configuration ---
const char* mqtt_server = "broker.mqtt.cool"; 
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32_DHT_LDR_Relay_Client"; // Ubah ID

// Topik Publish
const char* topic_temp = "uts/152023193/iot/sensor/temperature_c"; // Suhu Celsius
const char* topic_hum = "uts/152023193/iot/sensor/humidity";      // TOPIC BARU UNTUK KELEMBABAN
const char* topic_ldr = "uts/152023193/iot/sensor/ldr";           // Nilai LDR
const char* topic_relay_status = "uts/152023193/iot/status/relay"; // Status Relay

// Topik Subscribe untuk kontrol Relay
const char* mqtt_topic_subscribe_led = "uts/152023193/iot/control_led"; 

// --- 4. Setup Objects ---
// DHT Setup (Menggantikan DS18B20 Setup)
DHT dht(DHT_PIN, DHT_TYPE);

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


// --- 6. Implementation: WiFi dan MQTT Connection (TIDAK BERUBAH) ---

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

// Fungsi publish (Tidak Berubah)
void publish_float_data(const char* topic, float value) {
    char payload[8]; 
    dtostrf(value, 4, 2, payload); 
    
    if (!client.publish(topic, payload)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}

void publish_int_data(const char* topic, int value) {
    char payload[8]; 
    itoa(value, payload, 10); 
    
    if (!client.publish(topic, payload)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}

void publish_string_data(const char* topic, const char* value) {
    if (!client.publish(topic, value)) {
        Serial.print("Publish FAILED for ");
        Serial.println(topic);
    }
}


// --- 7. Setup dan Loop Utama ---

void setup() {
    Serial.begin(9600);
    
    // Inisialisasi Sensor DHT (Menggantikan sensors.begin())
    dht.begin();
    
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); 
    
    setup_wifi();
    
    // Konfigurasi MQTT Broker
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback_mqtt); 
    
    Serial.println("Sistem DHT, LDR, dan Relay Siap.");
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

        // --- 1. Baca Sensor DHT (Suhu & Kelembaban) ---
        float tempC = dht.readTemperature(); // Baca Suhu (Celsius)
        float hum = dht.readHumidity();      // Baca Kelembaban (Persen)
        
        // --- 2. Baca Sensor LDR (Cahaya) ---
        int ldrValue = analogRead(LDR_PIN); 

        // --- 3. Publish Data ---
        if (client.connected()) {
            
            // Cek jika pembacaan DHT valid
            if (!isnan(tempC) && !isnan(hum)) {
                
                // Suhu (Celsius)
                publish_float_data(topic_temp, tempC); 
                Serial.print("Suhu Published: ");
                Serial.print(tempC);
                Serial.println(" ºC"); 
                
                // Kelembaban (BARU!)
                publish_float_data(topic_hum, hum); 
                Serial.print("Kelembaban Published: ");
                Serial.print(hum);
                Serial.println(" %"); 
                
            } else {
                Serial.println("Error: Gagal membaca dari sensor DHT!");
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