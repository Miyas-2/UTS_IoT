// Global variables
let socket;
let sensorChart;
let chartData = {
    labels: [],
    temperature: [],
    humidity: [],
    light: []
};
const maxDataPoints = 20;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    initializeChart();
    initializeControls();
    
    // REMOVED: loadHistoryData() - tidak auto-load lagi
    showHistoryMessage('Click "Load Data" button to view historical data');
});

// Socket.IO initialization
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server via Socket.IO');
        updateConnectionStatus(true);
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });
    
    // Receive real-time sensor data (Updated untuk humidity)
    socket.on('realtime_update', function(data) {
        console.log('Received sensor data:', data);
        updateSensorDisplay(data);
        updateChart(data);
        updateLastUpdateTime();
    });
}

// Update sensor value displays (Updated untuk humidity)
function updateSensorDisplay(data) {
    // Temperature
    if (data.suhu !== null && data.suhu !== undefined) {
        document.getElementById('temperatureValue').textContent = data.suhu.toFixed(1);
    }
    
    // Humidity (BARU!)
    if (data.humidity !== null && data.humidity !== undefined) {
        document.getElementById('humidityValue').textContent = data.humidity.toFixed(1);
    }
    
    // Light
    if (data.lux !== null && data.lux !== undefined) {
        document.getElementById('lightValue').textContent = data.lux;
    }
    
    // Relay Status
    if (data.relayStatus) {
        const statusElement = document.getElementById('relayStatusDisplay');
        statusElement.textContent = data.relayStatus;
        statusElement.className = data.relayStatus === 'ON' ? 
            'text-2xl font-bold text-green-600' : 
            'text-2xl font-bold text-gray-600';
    }
}

// Initialize Chart.js (Updated untuk 3 datasets)
function initializeChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: chartData.temperature,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Humidity (%)',
                    data: chartData.humidity,
                    borderColor: 'rgb(6, 182, 212)',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Light Intensity',
                    data: chartData.light,
                    borderColor: 'rgb(245, 158, 11)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'DHT22 (Temperature & Humidity) + LDR Sensor Monitoring'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C) / Humidity (%)'
                    },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Light Intensity (LUX)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    min: 0
                }
            }
        }
    });
}

// Update chart with new data (Updated untuk humidity)
function updateChart(data) {
    if (data.suhu === null || data.humidity === null || data.lux === null) {
        return; // Skip incomplete data
    }
    
    const time = new Date(data.timestamp).toLocaleTimeString();
    
    // Add new data
    chartData.labels.push(time);
    chartData.temperature.push(data.suhu);
    chartData.humidity.push(data.humidity);
    chartData.light.push(data.lux);
    
    // Remove old data if exceeds maxDataPoints
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.temperature.shift();
        chartData.humidity.shift();
        chartData.light.shift();
    }
    
    sensorChart.update('none');
}

// Clear chart data
function clearChart() {
    chartData.labels = [];
    chartData.temperature = [];
    chartData.humidity = [];
    chartData.light = [];
    sensorChart.update();
}

// Initialize control buttons (UPDATED)
function initializeControls() {
    // LED ON button
    document.getElementById('ledOnBtn').addEventListener('click', function() {
        sendLEDCommand('ON');
    });
    
    // LED OFF button
    document.getElementById('ledOffBtn').addEventListener('click', function() {
        sendLEDCommand('OFF');
    });

    document.getElementById('loadSummaryBtn').addEventListener('click', loadSummaryData);

    
    // Clear chart button
    document.getElementById('clearChart').addEventListener('click', clearChart);
    
    // Load Data button (UPDATED) - hanya load ketika diklik
    document.getElementById('loadDataBtn').addEventListener('click', function() {
        loadHistoryData();
    });
    
    // History limit change (UPDATED) - tidak auto-load
    document.getElementById('historyLimit').addEventListener('change', function() {
        showHistoryMessage(`Changed to ${this.value} records. Click "Load Data" to refresh.`);
    });
}

async function loadSummaryData() {
    const loadBtn = document.getElementById('loadSummaryBtn');
    const summaryContent = document.getElementById('summaryContent');
    
    try {
        // Update button state
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading...';
        loadBtn.classList.add('opacity-50');
        
        // Show loading message
        summaryContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="animate-spin inline-block w-6 h-6 border-4 border-current border-t-transparent rounded-full mr-2"></div>
                Loading summary statistics...
            </div>
        `;
        
        // Fetch summary data
        const response = await fetch('/api/summary');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const summaryData = await response.json();
        console.log('Summary data received:', summaryData);
        
        // Display summary data
        displaySummaryData(summaryData);
        
    } catch (error) {
        console.error('Error loading summary:', error);
        summaryContent.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <div class="text-lg font-semibold">Error Loading Summary</div>
                <div class="text-sm mt-2">${error.message}</div>
                <button onclick="loadSummaryData()" class="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                    Try Again
                </button>
            </div>
        `;
    } finally {
        // Reset button state
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Summary';
        loadBtn.classList.remove('opacity-50');
    }
}

function displaySummaryData(data) {
    const summaryContent = document.getElementById('summaryContent');
    
    // Check if data is empty
    if (!data.suhumax && !data.suhumin && !data.suhurata) {
        summaryContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="text-lg font-semibold">No Data Available</div>
                <div class="text-sm mt-2">No sensor data found in the database</div>
            </div>
        `;
        return;
    }
    
    let html = `
        <!-- Temperature Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg">
                <div class="text-sm opacity-90">Maximum Temperature</div>
                <div class="text-2xl font-bold">${data.suhumax !== null ? data.suhumax : 'N/A'}°C</div>
            </div>
            <div class="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg">
                <div class="text-sm opacity-90">Minimum Temperature</div>
                <div class="text-2xl font-bold">${data.suhumin !== null ? data.suhumin : 'N/A'}°C</div>
            </div>
            <div class="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg">
                <div class="text-sm opacity-90">Average Temperature</div>
                <div class="text-2xl font-bold">${data.suhurata !== null ? data.suhurata : 'N/A'}°C</div>
            </div>
        </div>
    `;
    
    // Maximum Temperature Records
    if (data.nilai_suhu_max_humid_max && data.nilai_suhu_max_humid_max.length > 0) {
        html += `
            <div class="mb-6">
                <h4 class="text-lg font-semibold text-gray-700 mb-3">Records with Maximum Temperature (${data.suhumax}°C)</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full table-auto border border-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">ID</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Temperature (°C)</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Humidity (%)</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Light (LUX)</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        data.nilai_suhu_max_humid_max.forEach(record => {
            const timestamp = new Date(record.timestamp);
            const formattedTime = timestamp.toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2 text-sm text-gray-900">${record.idx}</td>
                    <td class="px-4 py-2 text-sm font-semibold text-blue-600">${record.suhu}</td>
                    <td class="px-4 py-2 text-sm text-cyan-600">${record.humid !== null ? record.humid : 'N/A'}</td>
                    <td class="px-4 py-2 text-sm text-yellow-600">${record.kecerahan !== null ? record.kecerahan : 'N/A'}</td>
                    <td class="px-4 py-2 text-sm text-gray-600">${formattedTime}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Month-Year Analysis
    if (data.month_year_max && data.month_year_max.length > 0) {
        html += `
            <div>
                <h4 class="text-lg font-semibold text-gray-700 mb-3">Months with Maximum Temperature Occurrences</h4>
                <div class="flex flex-wrap gap-2">
        `;
        
        data.month_year_max.forEach(monthData => {
            html += `
                <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    ${monthData.month_year}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    summaryContent.innerHTML = html;
}

// Send LED control command
function sendLEDCommand(command) {
    fetch('/api/control/led', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: command })
    })
    .then(response => response.json())
    .then(data => {
        console.log('LED control response:', data);
        if (data.success) {
            console.log(`LED turned ${command}`);
        } else {
            console.error('LED control failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Error controlling LED:', error);
    });
}

// Display history data in table (ENHANCED dengan detailed logging)
function displayHistoryData(data) {
    const tbody = document.getElementById('historyTableBody');
    
    console.log('📊 displayHistoryData called with:', data);
    console.log('📊 Data type:', typeof data);
    console.log('📊 Is Array?', Array.isArray(data));
    console.log('📊 Data length:', data ? data.length : 'null/undefined');
    
    // Clear existing content
    tbody.innerHTML = '';
    
    // Check if data exists and is array
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('❌ No data to display');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                No data available
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    console.log('✅ Processing', data.length, 'records');
    console.log('✅ First record sample:', data[0]);
    
    // Process each row
    data.forEach((row, index) => {
        console.log(`Processing row ${index + 1}:`, row);
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        // Safe value extraction dengan detailed logging
        const id = row.id || '-';
        
        let suhu = '-';
        if (row.suhu !== null && row.suhu !== undefined) {
            const suhuNum = parseFloat(row.suhu);
            suhu = isNaN(suhuNum) ? '-' : suhuNum.toFixed(1);
        }
        
        let humidity = '-';
        if (row.humidity !== null && row.humidity !== undefined) {
            const humidityNum = parseFloat(row.humidity);
            humidity = isNaN(humidityNum) ? '-' : humidityNum.toFixed(1);
        }
        
        let lux = '-';
        if (row.lux !== null && row.lux !== undefined) {
            const luxNum = parseInt(row.lux, 10);
            lux = isNaN(luxNum) ? '-' : luxNum;
        }
        
        const timestamp = formatTimestamp(row.timestamp);
        
        console.log(`Row ${index + 1} formatted:`, {
            id, suhu, humidity, lux, timestamp
        });
        
        // Create table row
        tr.innerHTML = `
            <td class="px-4 py-2 text-sm text-gray-900">${id}</td>
            <td class="px-4 py-2 text-sm text-blue-600 font-mono">${suhu}${suhu !== '-' ? '°C' : ''}</td>
            <td class="px-4 py-2 text-sm text-cyan-600 font-mono">${humidity}${humidity !== '-' ? '%' : ''}</td>
            <td class="px-4 py-2 text-sm text-yellow-600 font-mono">${lux}</td>
            <td class="px-4 py-2 text-sm text-gray-500 font-mono">${timestamp}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    console.log('✅ Successfully added', data.length, 'rows to table');
    console.log('✅ Table tbody children count:', tbody.children.length);
}

// Enhanced loadHistoryData dengan better debugging
function loadHistoryData() {
    const limit = document.getElementById('historyLimit').value;
    const loadBtn = document.getElementById('loadDataBtn');
    
    // Show loading state
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    showHistoryMessage(`Loading ${limit} records...`);
    
    console.log(`🔄 Starting load request - Limit: ${limit}`);
    
    fetch(`/api/history?limit=${limit}`)
    .then(response => {
        console.log('📥 Response status:', response.status);
        console.log('📥 Response ok:', response.ok);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(apiResponse => {
        console.log('📊 Full API Response:', apiResponse);
        console.log('📊 Response success:', apiResponse.success);
        console.log('📊 Response data type:', typeof apiResponse.data);
        console.log('📊 Response data is array:', Array.isArray(apiResponse.data));
        console.log('📊 Response data length:', apiResponse.data ? apiResponse.data.length : 'null');
        
        if (apiResponse.success && apiResponse.data) {
            console.log('✅ Calling displayHistoryData with:', apiResponse.data);
            displayHistoryData(apiResponse.data);
            
            // Show success message
            const successMsg = `✅ Loaded ${apiResponse.count || apiResponse.data.length} records (Total: ${apiResponse.total || 'unknown'})`;
            console.log('✅ Success message:', successMsg);
            showHistoryMessage(successMsg);
            
        } else {
            console.error('❌ API Response indicates failure:', apiResponse);
            showHistoryMessage(`❌ API Error: ${apiResponse.message || 'Unknown error'}`);
        }
    })
    .catch(error => {
        console.error('❌ Fetch Error:', error);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showHistoryMessage(`❌ Load Error: ${error.message}`);
    })
    .finally(() => {
        // Reset button state
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Data';
        console.log('🔄 Load operation completed');
    });
}

// Enhanced showHistoryMessage to avoid overwriting data
function showHistoryMessage(message) {
    const tbody = document.getElementById('historyTableBody');
    
    // Check if table is empty or only has message row
    const hasDataRows = tbody.children.length > 1 || 
        (tbody.children.length === 1 && !tbody.children[0].querySelector('[colspan="5"]'));
    
    if (!hasDataRows) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-600">
                    ${message}
                </td>
            </tr>
        `;
    } else {
        // If there are data rows, just log the message
        console.log('📊 Status message (not overwriting data):', message);
    }
}

// Rest of the code remains the same...
// ...existing functions...

// Update connection status
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const dot = statusElement.querySelector('div');
    const text = statusElement.querySelector('span');
    
    if (connected) {
        dot.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
        text.textContent = 'Connected';
    } else {
        dot.className = 'w-3 h-3 bg-red-500 rounded-full mr-2';
        text.textContent = 'Disconnected';
    }
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// REMOVED: Auto-refresh interval - tidak ada auto-refresh lagi
// setInterval(() => { loadHistoryData(); }, 30000);

console.log('IoT Dashboard initialized with DHT22 and LDR monitoring (Manual history load)');