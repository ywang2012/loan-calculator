// ==========================================
// 1. GLOBAL VARIABLES (MUST BE AT THE TOP)
// ==========================================
let extraPaymentsState = {};
let baseLoanDetails = {};
let myChart = null;
const themeStorageKey = 'loan_calc_theme';
let toastTimeoutId = null;

function parseCurrency(value) {
    if (typeof value !== 'string') return parseFloat(value);
    return parseFloat(value.replace(/[^0-9.-]/g, ''));
}

function formatNumber(value) {
    const number = typeof value === 'number' ? value : parseCurrency(String(value));
    if (!Number.isFinite(number)) return '';
    return number.toLocaleString('en-US');
}

function bindCurrencyInput(input) {
    if (!input) return;

    input.addEventListener('input', () => {
        const selectionStart = input.selectionStart || 0;
        const digitsBeforeCursor = input.value.slice(0, selectionStart).replace(/[^0-9]/g, '').length;

        const numeric = parseCurrency(input.value);
        if (Number.isNaN(numeric)) {
            input.value = '';
            return;
        }

        const formatted = formatNumber(numeric);
        input.value = formatted;

        let digitsSeen = 0;
        let newCursor = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                digitsSeen += 1;
            }
            if (digitsSeen >= digitsBeforeCursor) {
                newCursor = i + 1;
                break;
            }
        }
        input.setSelectionRange(newCursor, newCursor);
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeoutId = setTimeout(() => {
            toast.classList.add('hidden');
        }, 200);
    }, 2200);
}

// ==========================================
// 2. MAIN CALCULATE BUTTON LISTENER
// ==========================================
const calcBtn = document.getElementById('calc-btn');

if (calcBtn) {
    calcBtn.addEventListener('click', () => {
        const amountInput = document.getElementById('amount');
        const interestInput = document.getElementById('interest');
        const yearsInput = document.getElementById('years');

        const amount = parseCurrency(amountInput.value);
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

const amountInput = document.getElementById('amount');
bindCurrencyInput(amountInput);

// ==========================================
// 2.5 THEME TOGGLE
// ==========================================
const themeToggleBtn = document.getElementById('theme-toggle');

function getPreferredTheme() {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
}

function applyTheme(theme) {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem(themeStorageKey, theme);

    applyChartTheme(myChart);
}

if (themeToggleBtn) {
    const initialTheme = getPreferredTheme();
    themeToggleBtn.value = initialTheme;
    applyTheme(initialTheme);

    themeToggleBtn.addEventListener('change', (event) => {
        applyTheme(event.target.value);
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
                <td class="date-cell">${dateString}</td>
                <td>$${interestPayment.toFixed(2)}</td>
                <td>$${principalPayment.toFixed(2)}</td>
                <td>$${balance.toFixed(2)}</td>
                <td class="running-total">$${runningInterest.toFixed(2)}</td>
                <td class="running-total">$${runningPaid.toFixed(2)}</td>
                <td>
                    <input type="number"
                           class="extra-input"
                           data-month="${currentMonth}"
                           value="${extra > 0 ? extra : ''}"
                           placeholder="-"
                           inputmode="decimal">
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
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyChartTheme(chart) {
    if (!chart) return;

    const chartText = getCssVar('--chart-text') || '#2b2f33';
    const chartGrid = getCssVar('--chart-grid') || 'rgba(15, 23, 42, 0.08)';
    const principalColor = getCssVar('--accent') || '#4a90e2';
    const interestColor = getCssVar('--danger') || '#e74c3c';

    chart.data.datasets[0].backgroundColor = principalColor;
    chart.data.datasets[1].backgroundColor = interestColor;

    if (chart.options.scales?.x) {
        chart.options.scales.x.ticks.color = chartText;
        chart.options.scales.x.title.color = chartText;
        chart.options.scales.x.grid.color = chartGrid;
    }

    if (chart.options.scales?.y) {
        chart.options.scales.y.ticks.color = chartText;
        chart.options.scales.y.title.color = chartText;
        chart.options.scales.y.grid.color = chartGrid;
    }

    if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = chartText;
    }

    chart.update();
}

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
                    backgroundColor: getCssVar('--accent') || '#4a90e2',
                    stack: 'Stack 0',
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                },
                {
                    label: 'Interest',
                    data: interestData,
                    backgroundColor: getCssVar('--danger') || '#e74c3c',
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
                    title: { display: true, text: 'Payment Amount ($)', color: getCssVar('--chart-text') || '#2b2f33' },
                    ticks: { color: getCssVar('--chart-text') || '#2b2f33' },
                    grid: { color: getCssVar('--chart-grid') || 'rgba(15, 23, 42, 0.08)' }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Month', color: getCssVar('--chart-text') || '#2b2f33' },
                    ticks: { autoSkip: true, maxTicksLimit: 20, color: getCssVar('--chart-text') || '#2b2f33' },
                    grid: { color: getCssVar('--chart-grid') || 'rgba(15, 23, 42, 0.08)' }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { color: getCssVar('--chart-text') || '#2b2f33' } },
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
    applyChartTheme(myChart);
    myChart.resize();
}

const colorSchemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (colorSchemeQuery) {
    colorSchemeQuery.addEventListener('change', () => applyChartTheme(myChart));
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
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        // 1. Gather Data Headers
        let csvContent = "";
        csvContent += "Loan Amount,Interest Rate,Loan Term (Years),Start Date,Month,Date,Interest,Principal,Balance,Total Interest,Total Paid,Extra Payment\n";

        // 2. Update Row Loop
        const rows = document.querySelectorAll("#schedule-body tr");

        rows.forEach(row => {
            const cols = row.querySelectorAll("td");

            // Indices shifted because of new column
            const month = cols[0].innerText;
            const date = cols[1].innerText;
            const interest = cols[2].innerText.replace('$', '');
            const principal = cols[3].innerText.replace('$', '');
            const balance = cols[4].innerText.replace('$', '');
            const totalInt = cols[5].innerText.replace('$', '');
            const totalPaid = cols[6].innerText.replace('$', '');

            const extraInput = cols[7].querySelector('input'); // Moved to index 7
            const extra = extraInput ? (extraInput.value || "0") : "0";

            // Add date to CSV row
            const loanAmount = baseLoanDetails.amount;
            const loanRate = (baseLoanDetails.monthlyRate * 12 * 100).toFixed(3);
            const loanYears = (baseLoanDetails.totalMonths / 12).toFixed(2);
            const loanStartDate = baseLoanDetails.startDate || "";
            const csvRow = `${loanAmount},${loanRate},${loanYears},${loanStartDate},${month},${date},${interest},${principal},${balance},${totalInt},${totalPaid},${extra}`;
            csvContent += csvRow + "\n";
        });

        // 3. Trigger Save
        const fileName = "loan_schedule.csv";
        const fileBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [
                        {
                            description: "CSV file",
                            accept: { "text/csv": [".csv"] }
                        }
                    ]
                });
                const writable = await handle.createWritable();
                await writable.write(fileBlob);
                await writable.close();
                showToast("CSV saved");
            } catch (err) {
                if (err && err.name !== "AbortError") {
                    console.error("File save failed:", err);
                }
            }
        } else {
            const blobUrl = URL.createObjectURL(fileBlob);
            const link = document.createElement("a");
            link.setAttribute("href", blobUrl);
            link.setAttribute("download", fileName);
            document.body.appendChild(link); // Required for Firefox

            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            showToast("CSV downloaded");
        }
    });
}

// ==========================================
// 10. IMPORT CSV FUNCTIONALITY
// ==========================================
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);
    return result.map(value => value.trim());
}

function importCsvText(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        showToast("CSV file is empty");
        return;
    }

    const header = parseCsvLine(lines[0]).map(cell => cell.toLowerCase());
    const loanAmountIndex = header.indexOf('loan amount');
    const loanRateIndex = header.indexOf('interest rate');
    const loanYearsIndex = header.indexOf('loan term (years)');
    const startDateIndex = header.indexOf('start date');
    const monthIndex = header.indexOf('month');
    const extraIndex = header.indexOf('extra payment');

    if (monthIndex === -1 || extraIndex === -1) {
        showToast("CSV must include Month and Extra Payment columns");
        return;
    }

    const firstRow = parseCsvLine(lines[1] || "");
    const amountRaw = loanAmountIndex !== -1 ? firstRow[loanAmountIndex] : "";
    const rateRaw = loanRateIndex !== -1 ? firstRow[loanRateIndex] : "";
    const yearsRaw = loanYearsIndex !== -1 ? firstRow[loanYearsIndex] : "";
    const startDateRaw = startDateIndex !== -1 ? firstRow[startDateIndex] : "";

    const amount = parseCurrency(String(amountRaw));
    const rate = parseFloat(String(rateRaw).replace(/[^0-9.-]/g, ''));
    const years = parseFloat(String(yearsRaw).replace(/[^0-9.-]/g, ''));

    const amountInput = document.getElementById('amount');
    const interestInput = document.getElementById('interest');
    const yearsInput = document.getElementById('years');
    const startDateInput = document.getElementById('start-date');

    let updatedLoan = false;
    if (!Number.isNaN(amount) && !Number.isNaN(rate) && !Number.isNaN(years)) {
        amountInput.value = amount;
        interestInput.value = rate;
        yearsInput.value = years;
        if (startDateInput && typeof startDateRaw === 'string' && startDateRaw.trim().length > 0) {
            startDateInput.value = startDateRaw.trim();
        }

        const monthlyRate = rate / 100 / 12;
        const totalMonths = years * 12;
        const x = Math.pow(1 + monthlyRate, totalMonths);
        const monthlyPayment = (amount * x * monthlyRate) / (x - 1);

        if (isFinite(monthlyPayment)) {
            baseLoanDetails = {
                amount: amount,
                monthlyRate: monthlyRate,
                monthlyPayment: monthlyPayment,
                totalMonths: totalMonths,
                originalInterest: (monthlyPayment * totalMonths) - amount,
                startDate: startDateInput ? startDateInput.value : ""
            };

            document.getElementById('monthly-payment').innerText = '$' + monthlyPayment.toFixed(2);
            document.getElementById('total-payment').innerText = '$' + (monthlyPayment * totalMonths).toFixed(2);
            document.getElementById('total-interest').innerText = '$' + baseLoanDetails.originalInterest.toFixed(2);

            document.getElementById('results').classList.remove('hidden');
            const actionButtons = document.getElementById('action-buttons');
            if (actionButtons) actionButtons.classList.remove('hidden');
            const savingsSummary = document.getElementById('savings-summary');
            if (savingsSummary) savingsSummary.classList.add('hidden');

            updatedLoan = true;
        }
    }

    if (!updatedLoan && (!baseLoanDetails || !baseLoanDetails.amount)) {
        showToast("Add loan details or import a file with loan info");
        return;
    }

    extraPaymentsState = {};
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length <= Math.max(monthIndex, extraIndex)) continue;

        const month = parseInt(row[monthIndex], 10);
        const extraRaw = row[extraIndex] || '';
        const extra = parseFloat(extraRaw.replace(/[^0-9.-]/g, ''));

        if (!Number.isNaN(month) && !Number.isNaN(extra) && extra > 0) {
            extraPaymentsState[month] = extra;
            importedCount += 1;
        }
    }

    generateSchedule();
    if (updatedLoan && importedCount > 0) {
        showToast(`Imported loan and ${importedCount} extra payments`);
    } else if (updatedLoan) {
        showToast("Imported loan details");
    } else {
        showToast(importedCount > 0 ? `Imported ${importedCount} extra payments` : "No extra payments found");
    }
}

if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => importCsvText(reader.result || '');
        reader.onerror = () => showToast("Failed to read CSV file");
        reader.readAsText(file);

        importFileInput.value = '';
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
