// State & Constants
const categoriesData = {
    expense: {
        "Food": ["Groceries", "Takeout", "Dining Out", "Snacks"],
        "Bills": ["Rent", "Electricity", "Water", "Internet", "Phone"],
        "Transportation": ["Gas", "Public Transit", "Taxi", "Car Maintenance"],
        "Gym & Health": ["Membership", "Supplements", "Pharmacy"],
        "Entertainment": ["Movies", "Games", "Subscriptions"],
        "Shopping": ["Clothing", "Electronics", "Personal Care"],
        "Loans & Debt": [],
        "Dating & Social": ["Dates", "Gifts", "Events"],
        "Other (Custom)": []
    },
    income: {
        "Salary": [],
        "Freelancing": [],
        "Investments": [],
        "Gifts": [],
        "Family Support": [],
        "Loans": [],
        "Other (Custom)": []
    }
};

let transactionData = [];
let expenseChartInstance = null;
let incomeChartInstance = null;

// DOM Elements
const typeRadios = document.querySelectorAll('input[name="type"]');
const categorySelect = document.getElementById('category');
const customCategory = document.getElementById('custom-category');
const subcategoryGroup = document.getElementById('subcategory-group');
const subcategorySelect = document.getElementById('subcategory');
const customSubcategory = document.getElementById('custom-subcategory');
const dateInput = document.getElementById('date');

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('date')) {
        document.getElementById('date').valueAsDate = new Date();
    }
    if (typeof updateCategories === "function") updateCategories();
    loadTransactions();
});

function handleDateFilterChange() {
    const filter = document.getElementById('date-filter').value;
    const customInput = document.getElementById('custom-start-date');
    if (filter === 'custom') {
        customInput.classList.remove('hidden');
    } else {
        customInput.classList.add('hidden');
    }
    updateAnalysisUI();
}

// Tab Switching logic
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(`section-${tabName}`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'analysis') {
        loadTransactions(); // refresh data
    }
}

// Logic for Category / Subcategory dropdowns
function getSelectedType() {
    const radio = document.querySelector('input[name="type"]:checked');
    return radio ? radio.value : "expense";
}

function updateCategories() {
    const type = getSelectedType();
    const categories = Object.keys(categoriesData[type]);
    
    if (categorySelect) {
        categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
        handleCategoryChange();
    }
}

function handleCategoryChange() {
    if (!categorySelect) return;
    const type = getSelectedType();
    let cat = categorySelect.value;
    
    // Toggle Custom Category Input
    if (cat === "Other (Custom)") {
        customCategory.classList.remove('hidden');
        customCategory.required = true;
    } else {
        customCategory.classList.add('hidden');
        customCategory.required = false;
        customCategory.value = "";
    }

    // Update Subcategories
    const subs = categoriesData[type][cat] || [];
    
    if (subs.length > 0 || cat === "Other (Custom)") {
        subcategoryGroup.classList.remove('hidden');
        
        let subOptions = subs.map(s => `<option value="${s}">${s}</option>`);
        if(cat !== "Other (Custom)") subOptions.push(`<option value="Other (Custom)">Other (Custom)</option>`);
        
        subcategorySelect.innerHTML = subOptions.join('');
        handleSubcategoryChange();
    } else {
        subcategoryGroup.classList.add('hidden');
        subcategorySelect.innerHTML = "";
        customSubcategory.classList.add('hidden');
        customSubcategory.required = false;
    }
}

function handleSubcategoryChange() {
    let subCat = subcategorySelect.value;
    if (subCat === "Other (Custom)") {
        customSubcategory.classList.remove('hidden');
        customSubcategory.required = true;
    } else {
        customSubcategory.classList.add('hidden');
        customSubcategory.required = false;
        customSubcategory.value = "";
    }
}

// Form Submission
const form = document.getElementById('transaction-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = getSelectedType();
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('date').value;
        
        let category = categorySelect.value;
        if (category === "Other (Custom)") category = customCategory.value;

        let subcategory = "";
        if (!subcategoryGroup.classList.contains('hidden')) {
            subcategory = subcategorySelect.value;
            if (subcategory === "Other (Custom)") subcategory = customSubcategory.value;
        }

        const payload = { type, amount, date, category, subcategory };

        try {
            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                document.getElementById('amount').value = "";
                let status = document.getElementById('status-msg');
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 3000);
                loadTransactions(); // Refresh tables after adding
            }
        } catch (err) {
            console.error("Failed to save transaction", err);
            alert("Could not save transaction. Are you offline?");
        }
    });
}

// Fetching and Analysis
async function loadTransactions() {
    try {
        const res = await fetch('/api/transactions');
        if (res.redirected) {
             window.location.href = res.url;
             return;
        }
        transactionData = await res.json();
        updateAnalysisUI();
    } catch (err) {
        console.error("Error fetching data", err);
    }
}

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            loadTransactions();
        }
    } catch (err) {
        console.error("Error deleting transaction", err);
        alert("Failed to delete transaction.");
    }
}

function updateAnalysisUI() {
    let totalIncome = 0;
    let totalExpense = 0;
    
    let expensesByCategory = {};
    let incomeByCategory = {};

    const tableBody = document.querySelector('#transactions-table tbody');
    if (tableBody) tableBody.innerHTML = "";

    const inputTableBody = document.querySelector('#input-transactions-table tbody');
    if (inputTableBody) inputTableBody.innerHTML = "";

    const filterElem = document.getElementById('date-filter');
    const filterValue = filterElem ? filterElem.value : "current_month";
    const customStart = document.getElementById('custom-start-date') ? document.getElementById('custom-start-date').value : "";
    
    const now = new Date();
    let cutoff = new Date("1970-01-01");

    if (filterValue === 'last_30') {
        cutoff.setDate(now.getDate() - 30);
    } else if (filterValue === 'last_90') {
        cutoff.setDate(now.getDate() - 90);
    } else if (filterValue === 'ytd') {
        cutoff = new Date(now.getFullYear(), 0, 1);
    } else if (filterValue === 'custom' && customStart) {
        cutoff = new Date(customStart);
    } else if (filterValue === 'current_month') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    transactionData.forEach(t => {
        const isExp = t.type === 'expense';
        const formattedAmount = `$${t.amount.toFixed(2)}`;
        
        // Input Table (Show all recent)
        if (inputTableBody) {
            const inputRow = document.createElement('tr');
            inputRow.innerHTML = `
                <td>${t.date}</td>
                <td>
                    <div>${t.category}</div>
                    <small class="${isExp ? 'badge-expense' : 'badge-income'}">${isExp ? 'EXP' : 'INC'}</small>
                </td>
                <td>${formattedAmount}</td>
                <td>
                    <button class="btn-danger" onclick="deleteTransaction(${t.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            inputTableBody.appendChild(inputRow);
        }

        const tDate = new Date(t.date);
        let shouldInclude = true;

        if (filterValue === 'current_month') {
            if (tDate.getFullYear() !== now.getFullYear() || tDate.getMonth() !== now.getMonth()) {
                shouldInclude = false;
            }
        } else if (filterValue !== 'all') {
            if (tDate < cutoff) {
                shouldInclude = false;
            }
        }

        if (!shouldInclude) return;

        // Analysis Table
        if (tableBody) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date}</td>
                <td>${t.category} ${t.subcategory ? `<small class="td-sub">(${t.subcategory})</small>` : ''}</td>
                <td class="${isExp ? 'badge-expense' : 'badge-income'}">${isExp ? 'EXP' : 'INC'}</td>
                <td>${formattedAmount}</td>
            `;
            tableBody.appendChild(row);
        }

        // Aggregation
        if (isExp) {
            totalExpense += t.amount;
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        } else {
            totalIncome += t.amount;
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        }
    });

    const netBalElem = document.getElementById('net-balance');
    const totIncElem = document.getElementById('total-income');
    const totExpElem = document.getElementById('total-expense');

    if (totIncElem) totIncElem.innerText = `$${totalIncome.toFixed(2)}`;
    if (totExpElem) totExpElem.innerText = `$${totalExpense.toFixed(2)}`;
    if (netBalElem) netBalElem.innerText = `$${(totalIncome - totalExpense).toFixed(2)}`;

    renderCharts(expensesByCategory, incomeByCategory);
}

// Chart Colors
const backgroundColors = [
    'rgba(255, 99, 132, 0.7)','rgba(54, 162, 235, 0.7)','rgba(255, 206, 86, 0.7)',
    'rgba(75, 192, 192, 0.7)','rgba(153, 102, 255, 0.7)','rgba(255, 159, 64, 0.7)'
];

function renderCharts(expenseData, incomeData) {
    const ctxExp = document.getElementById('expenseChart');
    const ctxInc = document.getElementById('incomeChart');
    if(!ctxExp || !ctxInc) return;

    if (expenseChartInstance) expenseChartInstance.destroy();
    if (incomeChartInstance) incomeChartInstance.destroy();

    expenseChartInstance = new Chart(ctxExp.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(expenseData),
            datasets: [{
                data: Object.values(expenseData),
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    incomeChartInstance = new Chart(ctxInc.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(incomeData),
            datasets: [{
                data: Object.values(incomeData),
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}
