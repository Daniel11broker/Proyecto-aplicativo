document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (window.innerWidth >= 768) {
        sidebar.addEventListener('mouseenter', () => sidebar.classList.add('expanded'));
        sidebar.addEventListener('mouseleave', () => sidebar.classList.remove('expanded'));
    }
    mobileMenuButton.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('expanded'); });
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && sidebar.classList.contains('expanded') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('expanded');
        }
    });

    const dom = {
        themeToggle: document.getElementById('theme-toggle'),
        periodFilter: document.getElementById('period-filter'),
        kpi: {
            netProfit: document.getElementById('kpi-net-profit'),
            totalCash: document.getElementById('kpi-total-cash'),
            pipelineValue: document.getElementById('kpi-pipeline-value'),
            accountsReceivable: document.getElementById('kpi-accounts-receivable'),
            accountsPayable: document.getElementById('kpi-accounts-payable'),
            inventoryValue: document.getElementById('kpi-inventory-value'),
            employeeCount: document.getElementById('kpi-employee-count'),
        },
        charts: {
            monthlyPnl: document.getElementById('monthly-pnl-chart')?.getContext('2d'),
            assetsLiabilities: document.getElementById('assets-liabilities-chart')?.getContext('2d'),
            topClients: document.getElementById('top-clients-chart')?.getContext('2d'),
        }
    };
    
    let allData = {};
    let charts = {};

    const loadAllData = () => {
        allData = {
            invoices: (JSON.parse(localStorage.getItem('facturacion_data_v1')) || { invoices: [] }).invoices,
            bills: (JSON.parse(localStorage.getItem('compras_data_v1')) || { bills: [] }).bills,
            payrollHistory: (JSON.parse(localStorage.getItem('nomina_data_v2')) || { payrollHistory: [] }).payrollHistory,
            inventory: JSON.parse(localStorage.getItem('inventory')) || [],
            employees: (JSON.parse(localStorage.getItem('sgsst_data_v5')) || { employees: [] }).employees,
            accounts: (JSON.parse(localStorage.getItem('tesoreria_data_v1')) || { accounts: [] }).accounts,
            debtors: JSON.parse(localStorage.getItem('debtors')) || [],
            opportunities: (JSON.parse(localStorage.getItem('crm_data_v1')) || { opportunities: [] }).opportunities,
        };
    };

    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    const getDateRange = () => {
        const filter = dom.periodFilter.value;
        const today = new Date();
        let startDate;
        switch (filter) {
            case 'last_3_months': startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1); break;
            case 'this_year': startDate = new Date(today.getFullYear(), 0, 1); break;
            default: startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        return { startDate, endDate: new Date() };
    };

    const calculateMetrics = () => {
        const { startDate, endDate } = getDateRange();
        
        // Métricas que dependen del período
        const filteredInvoices = allData.invoices.filter(inv => {
            const issueDate = new Date(inv.issueDate);
            return inv.status !== 'Borrador' && issueDate >= startDate && issueDate <= endDate;
        });
        const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);

        const filteredBills = allData.bills.filter(bill => { const billDate = new Date(bill.date); return billDate >= startDate && billDate <= endDate; });
        const supplierExpenses = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
        
        const filteredPayrolls = allData.payrollHistory.filter(p => { const periodDate = new Date(p.period + '-02'); return periodDate >= startDate && periodDate <= endDate; });
        const payrollExpenses = filteredPayrolls.reduce((sum, p) => sum + p.records.reduce((s, r) => s + r.totalCompanyCost, 0), 0);

        const totalExpenses = supplierExpenses + payrollExpenses;
        const netProfit = totalRevenue - totalExpenses;

        // Métricas que son un snapshot actual (no dependen del período)
        const totalCash = allData.accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
        const pipelineValue = allData.opportunities.filter(o => !o.stage.startsWith('Cerrada')).reduce((sum, o) => sum + (o.value || 0), 0);
        const accountsReceivable = allData.debtors.reduce((sum, d) => sum + (d.balance || 0), 0);
        const accountsPayable = allData.bills.filter(b => b.status !== 'Pagada').reduce((sum, b) => sum + (b.balance || 0), 0);
        const inventoryValue = allData.inventory.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.quantity || 0)), 0);
        const employeeCount = allData.employees.filter(e => e.status === 'Activo').length;

        return { netProfit, totalCash, pipelineValue, accountsReceivable, accountsPayable, inventoryValue, employeeCount, filteredInvoices };
    };

    const renderDashboard = () => {
        const metrics = calculateMetrics();

        dom.kpi.netProfit.textContent = formatCurrency(metrics.netProfit);
        dom.kpi.netProfit.className = `text-4xl font-bold mt-2 ${metrics.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`;
        dom.kpi.totalCash.textContent = formatCurrency(metrics.totalCash);
        dom.kpi.pipelineValue.textContent = formatCurrency(metrics.pipelineValue);
        dom.kpi.accountsReceivable.textContent = formatCurrency(metrics.accountsReceivable);
        dom.kpi.accountsPayable.textContent = formatCurrency(metrics.accountsPayable);
        dom.kpi.inventoryValue.textContent = formatCurrency(metrics.inventoryValue);
        dom.kpi.employeeCount.textContent = metrics.employeeCount;

        renderPnlChart();
        renderAssetsLiabilitiesChart(metrics);
        renderTopClientsChart(metrics.filteredInvoices);
    };
    
    const renderPnlChart = () => {
        const { startDate } = getDateRange();
        const months = [], monthlyRevenue = {}, monthlyExpenses = {};
        let d = new Date(startDate);
        d.setDate(1); // Asegurar que empezamos el primer día del mes

        while (d <= new Date()) {
            const monthKey = d.toISOString().slice(0, 7);
            months.push(monthKey);
            monthlyRevenue[monthKey] = 0; 
            monthlyExpenses[monthKey] = 0;
            d.setMonth(d.getMonth() + 1);
        }
        allData.invoices.forEach(inv => { const k = inv.issueDate.slice(0, 7); if(monthlyRevenue[k] !== undefined) monthlyRevenue[k] += inv.total; });
        allData.bills.forEach(bill => { const k = bill.date.slice(0, 7); if(monthlyExpenses[k] !== undefined) monthlyExpenses[k] += bill.total; });
        allData.payrollHistory.forEach(p => { const k = p.period; if(monthlyExpenses[k] !== undefined) monthlyExpenses[k] += p.records.reduce((s, r) => s + r.totalCompanyCost, 0); });

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        
        if (charts.monthlyPnl) charts.monthlyPnl.destroy();
        charts.monthlyPnl = new Chart(dom.charts.monthlyPnl, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Ingresos', data: months.map(m => monthlyRevenue[m]), backgroundColor: 'rgba(34, 197, 94, 0.7)' },
                    { label: 'Gastos', data: months.map(m => monthlyExpenses[m]), backgroundColor: 'rgba(239, 68, 68, 0.7)' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { 
                y: { ticks: { color: textColor }, grid: { color: gridColor } }, 
                x: { ticks: { color: textColor }, grid: { color: gridColor } }
            }, plugins: { legend: { labels: { color: textColor } } } }
        });
    };

    const renderAssetsLiabilitiesChart = (metrics) => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e5e7eb' : '#374151';

        if (charts.assetsLiabilities) charts.assetsLiabilities.destroy();
        charts.assetsLiabilities = new Chart(dom.charts.assetsLiabilities, {
            type: 'doughnut',
            data: {
                labels: ['Efectivo', 'Cuentas por Cobrar', 'Inventario', 'Cuentas por Pagar'],
                datasets: [{
                    label: 'Composición',
                    data: [metrics.totalCash, metrics.accountsReceivable, metrics.inventoryValue, metrics.accountsPayable],
                    backgroundColor: ['#10B981', '#FBBF24', '#6366F1', '#EF4444'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: textColor } } } }
        });
    };

    const renderTopClientsChart = (invoices) => {
        const clientTotals = {};
        invoices.forEach(inv => { clientTotals[inv.clientName] = (clientTotals[inv.clientName] || 0) + inv.total; });
        const sortedClients = Object.entries(clientTotals).sort(([,a], [,b]) => b - a).slice(0, 5);

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#e5e7eb' : '#374151';

        if (charts.topClients) charts.topClients.destroy();
        charts.topClients = new Chart(dom.charts.topClients, {
            type: 'bar',
            data: {
                labels: sortedClients.map(c => c[0]),
                datasets: [{
                    label: 'Facturación',
                    data: sortedClients.map(c => c[1]),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    x: { ticks: { color: textColor }, grid: { color: gridColor } }, 
                    y: { ticks: { color: textColor }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    };

    const init = () => {
        const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
        applyTheme(localStorage.getItem('theme') || 'light');
        dom.themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            renderDashboard();
        });
        dom.periodFilter.addEventListener('change', renderDashboard);
        loadAllData();
        renderDashboard();
    };
    
    init();
});