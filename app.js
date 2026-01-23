// ==========================================
// 1. GLOBAL VARIABLES (MUST BE AT THE TOP)
// ==========================================
let extraPaymentsState = {};
let baseLoanDetails = {};
let myChart = null;

// ==========================================
// 2. MAIN CALCULATE BUTTON LISTENER
// ==========================================
const calcBtn = document.getElementById('calc-btn');

if (calcBtn) {
    calcBtn.addEventListener('click', () => {
        const amountInput = document.getElementById('amount');
        const interestInput = document.getElementById('interest');
        const yearsInput = document.getElementById('years');

        const amount = parseFloat(amountInput.value);
        const interest = parseFloat(interestInput.value);
        const years = parseFloat(yearsInput.value);

        if (isNaN(amount) || isNaN(interest) || isNaN(years)) {
            alert("Please enter valid numbers");
            return;
        }

        // Reset Extra Payments when starting a new calculation
        extraPaymentsState = {};

        const monthlyRate = interest / 100 / 12;
        const totalMonths = years * 12;

        // Mortgage Formula
        const x = Math.pow(1 + monthlyRate, totalMonths);
        const monthlyPayment = (amount * x * monthlyRate) / (x - 1);

        // Get the start date value (format is "YYYY-MM")
        const startDateValue = document.getElementById('start-date').value;

        if (isFinite(monthlyPayment)) {
            // Store data globally, including the start date
            baseLoanDetails = {
                amount: amount,
                monthlyRate: monthlyRate,
                monthlyPayment: monthlyPayment,
                totalMonths: totalMonths,
                originalInterest: (monthlyPayment * totalMonths) - amount,
                startDate: startDateValue // <--- Save this
            };

            // Update Summary UI
            document.getElementById('monthly-payment').innerText = '$' + monthlyPayment.toFixed(2);
            document.getElementById('total-payment').innerText = '$' + (monthlyPayment * totalMonths).toFixed(2);
            document.getElementById('total-interest').innerText = '$' + baseLoanDetails.originalInterest.toFixed(2);

            // Show Sections
            document.getElementById('results').classList.remove('hidden');

            // Show Buttons (Check if element exists first to avoid errors)
            const actionButtons = document.getElementById('action-buttons');
            if (actionButtons) actionButtons.classList.remove('hidden');

            const savingsSummary = document.getElementById('savings-summary');
            if (savingsSummary) savingsSummary.classList.add('hidden');

            // Generate the initial schedule
            generateSchedule();
        }
    });
}

// ==========================================
// 3. SCHEDULE GENERATOR FUNCTION
// ==========================================
function generateSchedule() {
    // Safety Check
    if (!baseLoanDetails || !baseLoanDetails.amount) return;

    const { amount, monthlyRate, monthlyPayment, totalMonths, originalInterest } = baseLoanDetails;

    const scheduleBody = document.getElementById('schedule-body');
    scheduleBody.innerHTML = "";

    let balance = amount;

    // Summary Totals
    let actualTotalInterest = 0;
    let actualTotalPaid = 0;

    // Running Totals for Table Columns
    let runningInterest = 0;
    let runningPaid = 0;

    // Graph Data
    let labels = [];
    let principalData = [];
    let interestData = [];

    let currentMonth = 1;

    // --- DATE LOGIC SETUP ---
    let startYear, startMonthIndex;
    if (baseLoanDetails.startDate) {
        // Fix for timezone issues: Append time to ensure local date parsing
        // or simple split handling
        const parts = baseLoanDetails.startDate.split('-'); // ["2024", "05"]
        startYear = parseInt(parts[0]);
        startMonthIndex = parseInt(parts[1]) - 1; // JS months are 0-11
    }
    // ------------------------

    // Loop until balance is zero OR we hit the safety limit (totalMonths * 2)
    while (balance > 0.01 && currentMonth <= totalMonths * 2) {

        // 1. Calculate Date String for this row
        let dateString = "-";
        if (baseLoanDetails.startDate) {
            const d = new Date(startYear, startMonthIndex + (currentMonth - 1));
            dateString = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }

        // 2. Get Extra Payment
        const extra = extraPaymentsState[currentMonth] || 0;

        // 3. Calculate Interest for this month
        const interestPayment = balance * monthlyRate;

        // 4. Calculate Principal & Cash Flow
        let principalPayment = (monthlyPayment - interestPayment) + extra;
        let totalCashFlow = monthlyPayment + extra;

        // 5. Handle Payoff (Last Month Logic)
        if (principalPayment >= balance) {
            principalPayment = balance;
            totalCashFlow = interestPayment + principalPayment;
            balance = 0;
        } else {
            balance -= principalPayment;
        }

        // 6. Update Totals (CRITICAL STEP)
        runningInterest += interestPayment;
        runningPaid += totalCashFlow;

        actualTotalInterest += interestPayment;
        actualTotalPaid += totalCashFlow;

        // 7. Graph Data
        labels.push('M ' + currentMonth);
        principalData.push(principalPayment);
        interestData.push(interestPayment);

        // 8. Generate HTML Row
        const row = `
            <tr>
                <td>${currentMonth}</td>
                <td style="white-space: nowrap; color: #555; font-weight:500;">${dateString}</td>
                <td>$${interestPayment.toFixed(2)}</td>
                <td>$${principalPayment.toFixed(2)}</td>
                <td>$${balance.toFixed(2)}</td>
                <td style="color: #666;">$${runningInterest.toFixed(2)}</td>
                <td style="color: #666;">$${runningPaid.toFixed(2)}</td>
                <td>
                    <input type="number"
                           class="extra-input"
                           data-month="${currentMonth}"
                           value="${extra > 0 ? extra : ''}"
                           placeholder="-"
                           inputmode="decimal"
                           style="width: 70px; padding: 5px;">
                </td>
            </tr>
        `;
        scheduleBody.innerHTML += row;

        currentMonth++;
    }

    // 9. Finalize UI
    drawGraph(labels, principalData, interestData);
    updateSavings(currentMonth - 1, actualTotalInterest, totalMonths, originalInterest);
}
// ==========================================
// 4. EXTRA PAYMENT INPUT LISTENER
// ==========================================
const scheduleBody = document.getElementById('schedule-body');
if (scheduleBody) {
    scheduleBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('extra-input')) {
            const month = parseInt(e.target.dataset.month);
            const value = parseFloat(e.target.value);

            if (isNaN(value) || value <= 0) {
                delete extraPaymentsState[month];
            } else {
                extraPaymentsState[month] = value;
            }

            // Re-calculate everything with the new extra payment
            generateSchedule();
        }
    });
}

// ==========================================
// 5. SAVINGS SUMMARY UI UPDATER
// ==========================================
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

// ==========================================
// 6. GRAPH DRAWING FUNCTION
// ==========================================
function drawGraph(months, principalData, interestData) {
    // Safety check: Does the canvas exist?
    const canvas = document.getElementById('loanChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded. Please download chart.js to the project folder.");
        return;
    }

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
                x: {
                    stacked: true,
                    title: { display: true, text: 'Payment Amount ($)' }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Month' },
                    ticks: { autoSkip: true, maxTicksLimit: 20 },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });

    // Dynamic height adjustment
    const chartHeight = months.length * 8;
    ctx.canvas.style.height = (chartHeight < 300 ? 300 : chartHeight) + 'px';
    myChart.resize();
}

// ==========================================
// 7. TOGGLE BUTTON LISTENERS
// ==========================================
const toggleScheduleBtn = document.getElementById('toggle-schedule-btn');
if (toggleScheduleBtn) {
    toggleScheduleBtn.addEventListener('click', () => {
        document.getElementById('schedule-container').classList.toggle('hidden');
    });
}

const toggleChartBtn = document.getElementById('toggle-chart-btn');
if (toggleChartBtn) {
    toggleChartBtn.addEventListener('click', () => {
        document.getElementById('chart-wrapper').classList.toggle('hidden');
    });
}
// ==========================================
// 9. EXPORT TO CSV FUNCTIONALITY
// ==========================================
const exportBtn = document.getElementById('export-btn');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        // 1. Gather Data Headers
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Month,Date,Interest,Principal,Balance,Total Interest,Total Paid,Extra Payment\n"; // Added "Date"

        // 2. Update Row Loop
        const rows = document.querySelectorAll("#schedule-body tr");

        rows.forEach(row => {
            const cols = row.querySelectorAll("td");

            // Indices shifted because of new column
            const month = cols[0].innerText;
            const date = cols[1].innerText; // New Column
            const interest = cols[2].innerText.replace('$', '');
            const principal = cols[3].innerText.replace('$', '');
            const balance = cols[4].innerText.replace('$', '');
            const totalInt = cols[5].innerText.replace('$', '');
            const totalPaid = cols[6].innerText.replace('$', '');

            const extraInput = cols[7].querySelector('input'); // Moved to index 7
            const extra = extraInput ? (extraInput.value || "0") : "0";

            // Add date to CSV row
            const csvRow = `${month},${date},${interest},${principal},${balance},${totalInt},${totalPaid},${extra}`;
            csvContent += csvRow + "\n";
        });

        // 3. Trigger Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "loan_schedule.csv");
        document.body.appendChild(link); // Required for Firefox

        link.click();
        document.body.removeChild(link);
    });
}
// ==========================================
// 8. SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error:', err));
    });
}