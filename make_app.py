import zipfile
import os

# 1. Define the file contents
index_html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan Calc PWA</title>
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#4a90e2">
    <script src="chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>Loan Calculator</h1>
        
        <div class="input-group">
            <label for="amount">Loan Amount ($)</label>
            <input type="number" id="amount" placeholder="e.g. 20000">
        </div>

        <div class="input-group">
            <label for="interest">Interest Rate (%)</label>
            <input type="number" id="interest" placeholder="e.g. 4.5" step="0.1">
        </div>

        <div class="input-group">
            <label for="years">Loan Term (Years)</label>
            <input type="number" id="years" placeholder="e.g. 5">
        </div>

        <button id="calc-btn">Calculate</button>

        <div id="results" class="hidden">
            <h2>Monthly Payment</h2>
            <div class="monthly-payment" id="monthly-payment">$0.00</div>
            
            <div class="details">
                <p>Total Payment: <span id="total-payment">$0.00</span></p>
                <p>Total Interest: <span id="total-interest">$0.00</span></p>
            </div>
        </div>

        <div class="button-group hidden" id="action-buttons">
            <button id="toggle-schedule-btn" class="secondary-btn">Schedule</button>
            <button id="toggle-chart-btn" class="secondary-btn">Graphs</button>
        </div>

        <div class="chart-container hidden" id="chart-wrapper">
            <h3>Payment Composition</h3>
            <canvas id="loanChart"></canvas>
        </div>

        <div id="savings-summary" class="hidden" style="background: #d4edda; color: #155724; padding: 10px; border-radius: 8px; margin-top: 20px; text-align: center;">
            <strong>Impact:</strong> You will finish <span id="months-saved">0</span> months early and save <span id="interest-saved">$0.00</span> in interest!
        </div>

        <div id="schedule-container" class="hidden">
            <h3>Amortization Schedule</h3>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Extra</th>
                            <th>Interest</th>
                            <th>Principal</th>
                            <th>Balance</th>
                            <th>Total Int.</th>
                            <th>Total Paid</th>
                        </tr>
                    </thead>
                    <tbody id="schedule-body">
                        </tbody>
                </table>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>"""

style_css = """body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: #f4f7f6;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    width: 90%;
    max-width: 500px;
    margin: 20px 0;
}

h1 { text-align: center; color: #333; }
.input-group { margin-bottom: 1rem; }
label { display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.9rem; }

input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    box-sizing: border-box; 
}

button {
    width: 100%;
    padding: 15px;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: bold;
    margin-top: 10px;
}
button:active { background-color: #357abd; }

/* Results Section */
#results { margin-top: 2rem; text-align: center; border-top: 1px solid #eee; padding-top: 1rem; }
.hidden { display: none !important; }
.monthly-payment { font-size: 2.5rem; color: #2ecc71; font-weight: bold; margin: 10px 0; }
.details p { margin: 5px 0; color: #555; }

/* Button Group */
.button-group {
    display: flex;
    gap: 10px;
    margin-top: 1rem;
    width: 100%;
}
.button-group button {
    flex: 1;
    margin-top: 0;
    padding: 12px;
    font-size: 0.9rem;
}
#toggle-schedule-btn { background-color: #6c757d; }
#toggle-chart-btn { background-color: #2c3e50; }

/* Chart Container */
.chart-container {
    background: white;
    padding: 1rem;
    margin-top: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-height: 50vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}

/* Schedule Table */
.table-wrapper {
    overflow-x: auto;
    margin-top: 1rem;
    border-radius: 8px;
    box-shadow: 0 0 4px rgba(0,0,0,0.1);
}
table {
    width: 100%;
    border-collapse: collapse;
    min-width: 700px; /* Forces scroll on mobile */
}
th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
    font-size: 0.9rem;
}
th { background-color: #4a90e2; color: white; }
tr:nth-child(even) { background-color: #f9f9f9; }

/* Extra Payment Input */
.extra-input {
    width: 100%;
    max-width: 80px;
    padding: 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
    text-align: center;
    background-color: #fff;
}
.extra-input:focus {
    border-color: #4a90e2;
    outline: none;
    background-color: #f0f8ff;
}
"""

app_js = """// Global State for Extra Payments
let extraPaymentsState = {}; 
let baseLoanDetails = {}; 
let myChart = null;

// 1. Main Calculate Button
document.getElementById('calc-btn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('amount').value);
    const interest = parseFloat(document.getElementById('interest').value);
    const years = parseFloat(document.getElementById('years').value);

    if (isNaN(amount) || isNaN(interest) || isNaN(years)) {
        alert("Please enter valid numbers");
        return;
    }

    // Reset State
    extraPaymentsState = {}; 
    const monthlyRate = interest / 100 / 12;
    const totalMonths = years * 12;
    
    // Formula
    const x = Math.pow(1 + monthlyRate, totalMonths);
    const monthlyPayment = (amount * x * monthlyRate) / (x - 1);

    if (isFinite(monthlyPayment)) {
        baseLoanDetails = { amount, monthlyRate, monthlyPayment, totalMonths, originalInterest: (monthlyPayment * totalMonths) - amount };

        document.getElementById('monthly-payment').innerText = '$' + monthlyPayment.toFixed(2);
        document.getElementById('total-payment').innerText = '$' + (monthlyPayment * totalMonths).toFixed(2);
        document.getElementById('total-interest').innerText = '$' + baseLoanDetails.originalInterest.toFixed(2);
        document.getElementById('results').classList.remove('hidden');
        document.getElementById('action-buttons').classList.remove('hidden');
        document.getElementById('savings-summary').classList.add('hidden');

        generateSchedule();
    }
});

// 2. Schedule Generator
function generateSchedule() {
    const { amount, monthlyRate, monthlyPayment, totalMonths, originalInterest } = baseLoanDetails;
    
    const scheduleBody = document.getElementById('schedule-body');
    scheduleBody.innerHTML = ""; 
    
    let balance = amount;
    let actualTotalInterest = 0;
    let actualTotalPaid = 0;
    let runningInterest = 0;
    let runningPaid = 0;
    
    let labels = [];
    let principalData = [];
    let interestData = [];

    let currentMonth = 1;

    while (balance > 0.01 && currentMonth <= totalMonths * 2) {
        const extra = extraPaymentsState[currentMonth] || 0;
        const interestPayment = balance * monthlyRate;
        let principalPayment = (monthlyPayment - interestPayment) + extra;
        let totalCashFlow = monthlyPayment + extra;

        if (principalPayment > balance) {
            principalPayment = balance;
            totalCashFlow = interestPayment + principalPayment;
            balance = 0;
        } else {
            balance -= principalPayment;
        }

        runningInterest += interestPayment;
        runningPaid += totalCashFlow;
        actualTotalInterest += interestPayment;
        actualTotalPaid += totalCashFlow;

        labels.push('M ' + currentMonth);
        principalData.push(principalPayment);
        interestData.push(interestPayment);

        const row = `
            <tr>
                <td>${currentMonth}</td>
                <td>
                    <input type="number" class="extra-input" data-month="${currentMonth}" 
                           value="${extra > 0 ? extra : ''}" placeholder="-" style="width: 70px;">
                </td>
                <td>$${interestPayment.toFixed(2)}</td>
                <td>$${principalPayment.toFixed(2)}</td>
                <td>$${balance.toFixed(2)}</td>
                <td style="color: #666;">$${runningInterest.toFixed(2)}</td>
                <td style="color: #666;">$${runningPaid.toFixed(2)}</td>
            </tr>
        `;
        scheduleBody.innerHTML += row;
        currentMonth++;
    }

    drawGraph(labels, principalData, interestData);
    updateSavings(currentMonth - 1, actualTotalInterest, totalMonths, originalInterest);
}

// 3. Handle Extra Payment Input
document.getElementById('schedule-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('extra-input')) {
        const month = parseInt(e.target.dataset.month);
        const value = parseFloat(e.target.value);
        if (isNaN(value) || value <= 0) {
            delete extraPaymentsState[month];
        } else {
            extraPaymentsState[month] = value;
        }
        generateSchedule();
    }
});

// 4. Update Savings UI
function updateSavings(actualMonths, actualInterest, originalMonths, originalInterest) {
    const savingsBox = document.getElementById('savings-summary');
    const interestDiff = originalInterest - actualInterest;
    const monthsDiff = originalMonths - actualMonths;

    if (interestDiff > 1 || monthsDiff > 0) {
        savingsBox.classList.remove('hidden');
        document.getElementById('interest-saved').innerText = '$' + interestDiff.toFixed(2);
        document.getElementById('months-saved').innerText = monthsDiff;
    } else {
        savingsBox.classList.add('hidden');
    }
}

// 5. Graph Logic
function drawGraph(months, principalData, interestData) {
    const ctx = document.getElementById('loanChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Principal',
                    data: principalData,
                    backgroundColor: '#4a90e2',
                    stack: 'Stack 0',
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                },
                {
                    label: 'Interest',
                    data: interestData,
                    backgroundColor: '#e74c3c',
                    stack: 'Stack 0',
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, title: { display: true, text: 'Payment ($)' } },
                y: { stacked: true, ticks: { autoSkip: true, maxTicksLimit: 20 }, grid: { display: false } }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
    
    const chartHeight = months.length * 8; 
    ctx.canvas.style.height = (chartHeight < 300 ? 300 : chartHeight) + 'px';
    myChart.resize(); 
}

// 6. Toggle Buttons
document.getElementById('toggle-schedule-btn').addEventListener('click', () => {
    document.getElementById('schedule-container').classList.toggle('hidden');
});
document.getElementById('toggle-chart-btn').addEventListener('click', () => {
    document.getElementById('chart-wrapper').classList.toggle('hidden');
});

// 7. Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Error:', err));
    });
}
"""

sw_js = """const CACHE_NAME = 'loan-calc-final-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './chart.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
"""

manifest_json = """{
  "name": "Loan Planner",
  "short_name": "LoanCalc",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f4f7f6",
  "theme_color": "#4a90e2",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
"""

readme_txt = """INSTRUCTIONS:

1. CHART.JS:
   You need to download the Chart.js library manually because Python didn't fetch it.
   - Go to: https://cdn.jsdelivr.net/npm/chart.js
   - Right Click -> Save As...
   - Save it inside this folder as "chart.js"

2. ICONS:
   Create a folder named "icons".
   Add two PNG images inside: "icon-192.png" and "icon-512.png".

3. RUNNING:
   Open this folder in VS Code.
   Right click "index.html" -> Open with Live Server.
"""

# 2. Create the ZIP file
zip_filename = "loan-calculator.zip"
with zipfile.ZipFile(zip_filename, 'w') as zf:
    zf.writestr("index.html", index_html)
    zf.writestr("style.css", style_css)
    zf.writestr("app.js", app_js)
    zf.writestr("sw.js", sw_js)
    zf.writestr("manifest.json", manifest_json)
    zf.writestr("README.txt", readme_txt)

print(f"Successfully created {zip_filename}")
print("Don't forget to download chart.js and add icons!")
