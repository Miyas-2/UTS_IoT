// Script dengan fitur history limit selector

let socket;
let chart;
let currentHistoryLimit = 100; // Default limit

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    initializeChart();
    initializeControls();
    loadRecentData(); // Load recent data from database
});

// Socket.IO initialization
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        updateConnectionStatus(true);
        console.log('Socket.IO connected');
    });
    
    socket.on('disconnect', function() {
        updateConnectionStatus(false);
        console.log('Socket.IO disconnected');
    });
    
    socket.on('realtime_update', function(data) {
        console.log('Real-time data received:', data);
        updateDisplay(data);
        updateChart(data);
        // Auto-refresh table when new data comes in (only if showing 10 records)
        if (currentHistoryLimit <= 10) {
            setTimeout(loadRecentData, 1000);
        }
    });
}

// Update connection status
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (connected) {
        status.textContent = 'Connected';
        status.className = 'px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800';
    } else {
        status.textContent = 'Disconnected';
        status.className = 'px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800';
    }
}

// Update display with new data
function updateDisplay(data) {
    if (data.suhu !== null && data.suhu !== undefined) {
        document.getElementById('temperatureValue').textContent = data.suhu.toFixed(1);
        document.getElementById('tempTimestamp').textContent = formatTime(data.timestamp);
    }
    
    if (data.lux !== null && data.lux !== undefined) {
        document.getElementById('lightValue').textContent = data.lux;
        document.getElementById('lightTimestamp').textContent = formatTime(data.timestamp);
    }
    
    if (data.relayStatus) {
        const statusEl = document.getElementById('relayStatus');
        statusEl.textContent = data.relayStatus;
        if (data.relayStatus === 'ON') {
            statusEl.className = 'px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800';
        } else {
            statusEl.className = 'px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800';
        }
        document.getElementById('relayTimestamp').textContent = formatTime(data.timestamp);
    }
}

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return '--';
    try {
        return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
        return '--';
    }
}

// Initialize chart - Start empty, only fill from MQTT
function initializeChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1
            }, {
                label: 'Light (Lux)',
                data: [],
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Live MQTT Data (Real-time Only)'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Light (Lux)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Update chart with new MQTT data only
function updateChart(data) {
    if (!chart || data.suhu === null || data.lux === null) return;
    
    const time = formatTime(data.timestamp);
    
    // Add new data point from MQTT
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(data.suhu);
    chart.data.datasets[1].data.push(data.lux);
    
    // Keep only last 20 points for real-time view
    if (chart.data.labels.length > 20) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
    }
    
    chart.update('none');
}

// Initialize controls
function initializeControls() {
    document.getElementById('ledOnBtn').addEventListener('click', () => controlLED('ON'));
    document.getElementById('ledOffBtn').addEventListener('click', () => controlLED('OFF'));
    document.getElementById('clearChart').addEventListener('click', clearChart);
    document.getElementById('loadHistory').addEventListener('click', loadRecentData);
    document.getElementById('clearTable').addEventListener('click', clearTable);
    
    // History limit selector
    document.getElementById('historyLimit').addEventListener('change', function() {
        currentHistoryLimit = parseInt(this.value);
        loadRecentData(); // Auto-load when limit changes
    });
}

// Control LED
async function controlLED(command) {
    const statusEl = document.getElementById('controlStatus');
    statusEl.textContent = 'Sending...';
    statusEl.className = 'text-sm text-blue-600';
    
    try {
        const response = await fetch('/api/control/led', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusEl.textContent = `LED turned ${command}`;
            statusEl.className = 'text-sm text-green-600';
        } else {
            statusEl.textContent = `Error: ${result.message}`;
            statusEl.className = 'text-sm text-red-600';
        }
    } catch (error) {
        statusEl.textContent = 'Failed to send command';
        statusEl.className = 'text-sm text-red-600';
    }
    
    setTimeout(() => {
        statusEl.textContent = '';
    }, 3000);
}

// Load recent data from database with selected limit
async function loadRecentData() {
    try {
        console.log(`Loading recent data from database (limit: ${currentHistoryLimit})...`);
        const response = await fetch(`/api/history?limit=${currentHistoryLimit}`);
        const result = await response.json();
        
        console.log('Database response:', result);
        
        if (result.success && result.data) {
            populateTable(result.data);
            updateDataCount(result.count, result.limit);
        } else {
            console.error('Failed to load recent data from database');
            populateTable([]);
            updateDataCount(0, currentHistoryLimit);
        }
    } catch (error) {
        console.error('Error loading recent data:', error);
        populateTable([]);
        updateDataCount(0, currentHistoryLimit);
    }
}

// Update data count display
function updateDataCount(count, limit) {
    const countEl = document.getElementById('dataCount');
    countEl.textContent = `Showing ${count} of ${limit} records`;
}

// Populate table with database data
function populateTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    
    console.log('Populating table with data:', data);
    
    if (!data || data.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 4;
        cell.textContent = 'No data available';
        cell.className = 'px-4 py-8 text-center text-gray-500 italic';
        return;
    }
    
    // Data sudah ter-order DESC dari database, tidak perlu reverse
    data.forEach((item, index) => {
        const row = tbody.insertRow();
        row.className = 'hover:bg-gray-50 animate-fade-in';
        
        // ID column
        const idCell = row.insertCell(0);
        idCell.textContent = item.id;
        idCell.className = 'px-4 py-2 font-medium text-gray-900';
        
        // Temperature column
        const tempCell = row.insertCell(1);
        tempCell.textContent = item.suhu ? parseFloat(item.suhu).toFixed(1) + '°C' : '--';
        tempCell.className = 'px-4 py-2 text-blue-600 font-medium';
        
        // Light column
        const lightCell = row.insertCell(2);
        lightCell.textContent = item.lux ? parseInt(item.lux) + ' Lux' : '--';
        lightCell.className = 'px-4 py-2 text-yellow-600 font-medium';
        
        // Timestamp column
        const timeCell = row.insertCell(3);
        try {
            timeCell.textContent = new Date(item.timestamp).toLocaleString();
        } catch (error) {
            timeCell.textContent = item.timestamp || '--';
        }
        timeCell.className = 'px-4 py-2 text-gray-500 text-sm';
    });
}

// Clear chart
function clearChart() {
    if (!chart) return;
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();
}

// Clear table
function clearTable() {
    document.getElementById('dataTableBody').innerHTML = '';
    updateDataCount(0, currentHistoryLimit);
}

// Auto-refresh table data every 60 seconds (only for 10 records)
setInterval(() => {
    if (currentHistoryLimit <= 10) {
        loadRecentData();
    }
}, 60000);