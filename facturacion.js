document.addEventListener('DOMContentLoaded', () => {
    // Lógica del menú lateral y tema
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
        invoiceListView: document.getElementById('invoice-list-view'),
        invoiceEditorView: document.getElementById('invoice-editor-view'),
        finalizeOptionsModal: document.getElementById('finalize-options-modal'),
        settingsModal: document.getElementById('settings-modal'),
    };
    
    let config = { 
        IVA_RATE: 0.19, 
        RETEFUENTE_RATE: 0.04,
        RETEICA_RATE: 0.00966,
        company: { name: 'Mi Empresa SAS', nit: '900.123.456-7' }, 
        paymentTermsDays: 30 
    };

    let facturacionData = {}, inventoryData = [], clientsData = [], debtorsData = [], currentView = 'list', editingId = null;
    let state = {
        filters: {
            search: '',
            status: 'Todos'
        }
    };
    const defaultData = { invoices: [], lastInvoiceNumber: 0 };
    
    const saveSettings = () => localStorage.setItem('facturacion_settings_v1', JSON.stringify({ RETEFUENTE_RATE: config.RETEFUENTE_RATE, RETEICA_RATE: config.RETEICA_RATE }));
    const loadSettings = () => {
        const settings = JSON.parse(localStorage.getItem('facturacion_settings_v1'));
        if (settings) {
            config.RETEFUENTE_RATE = parseFloat(settings.RETEFUENTE_RATE) || 0.04;
            config.RETEICA_RATE = parseFloat(settings.RETEICA_RATE) || 0.00966;
        }
    };

    const saveData = () => localStorage.setItem('facturacion_data_v1', JSON.stringify(facturacionData));
    const loadData = () => {
        facturacionData = JSON.parse(localStorage.getItem('facturacion_data_v1')) || JSON.parse(JSON.stringify(defaultData));
        inventoryData = JSON.parse(localStorage.getItem('inventory')) || [];
        clientsData = JSON.parse(localStorage.getItem('clients')) || [];
        debtorsData = JSON.parse(localStorage.getItem('debtors')) || [];
    };
    
    const syncInvoiceStatuses = () => {
        let updated = false;
        facturacionData.invoices.forEach(inv => {
            if (inv.status === 'Emitida') {
                const debtor = debtorsData.find(d => d.invoiceNumber === `FV-${inv.invoiceNumber}`);
                if (debtor && debtor.status === 'Pagado') {
                    inv.status = 'Pagada'; 
                    updated = true;
                }
            }
        });
        if (updated) saveData();
    };
    
    const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
    const formatDate = (d) => { const date = new Date(d); return new Date(date.getTime() + (date.getTimezoneOffset() * 60000)).toLocaleDateString('es-CO'); };
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const icon = type === 'success' ? 'check-circle' : type === 'info' ? 'info' : 'alert-triangle';
        toast.className = `toast ${type === 'success' ? 'bg-green-600' : type === 'info' ? 'bg-blue-600' : 'bg-red-600'} text-white py-3 px-5 rounded-lg shadow-lg flex items-center gap-3`;
        toast.innerHTML = `<i data-feather="${icon}" class="h-5 w-5"></i><span>${message}</span>`;
        container.appendChild(toast);
        feather.replace();
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 4000);
    };

    const render = () => {
        loadData();
        syncInvoiceStatuses();
        if (currentView === 'list') {
            dom.invoiceListView.classList.remove('hidden');
            dom.invoiceEditorView.classList.add('hidden');
            renderInvoiceListView();
        } else {
            dom.invoiceListView.classList.add('hidden');
            dom.invoiceEditorView.classList.remove('hidden');
            renderInvoiceEditorView(editingId);
        }
        feather.replace();
    };

    const renderInvoiceTable = () => {
        const filteredInvoices = facturacionData.invoices.filter(inv => {
            const today = new Date(); today.setHours(0,0,0,0);
            const dueDate = new Date(inv.dueDate); dueDate.setMinutes(dueDate.getMinutes() + dueDate.getTimezoneOffset());
            const isOverdue = inv.status !== 'Pagada' && dueDate < today;
            const effectiveStatus = inv.status === 'Emitida' && isOverdue ? 'Vencida' : inv.status;

            const matchesStatus = state.filters.status === 'Todos' || effectiveStatus === state.filters.status;
            
            const searchTerm = state.filters.search.toLowerCase();
            const matchesSearch = !searchTerm ||
                inv.clientName.toLowerCase().includes(searchTerm) ||
                `fv-${inv.invoiceNumber}`.toLowerCase().includes(searchTerm);

            return matchesStatus && matchesSearch;
        });

        const tableBody = dom.invoiceListView.querySelector('tbody');
        if (!tableBody) return;

        let tableContent = filteredInvoices.length === 0 
            ? `<tr><td colspan="6" class="text-center p-8"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><h3 class="mt-2 text-sm font-semibold">No se encontraron facturas</h3><p class="mt-1 text-sm text-gray-500">Intenta ajustar tu búsqueda o filtros.</p></td></tr>`
            : filteredInvoices.slice().reverse().map(inv => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const dueDate = new Date(inv.dueDate); dueDate.setMinutes(dueDate.getMinutes() + dueDate.getTimezoneOffset());
                const isOverdue = inv.status !== 'Pagada' && dueDate < today;
                const statusColor = inv.status === 'Pagada' ? 'bg-green-100 text-green-800' : inv.status === 'Borrador' ? 'bg-gray-100 text-gray-800' : isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                const statusText = inv.status === 'Emitida' && isOverdue ? 'Vencida' : inv.status;
                return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-6 py-4 font-medium">FV-${inv.invoiceNumber}</td><td class="px-6 py-4">${inv.clientName}</td>
                    <td class="px-6 py-4">${formatDate(inv.issueDate)}</td><td class="px-6 py-4">${formatCurrency(inv.total)}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">${statusText}</span></td>
                    <td class="px-6 py-4 text-right flex justify-end gap-1">
                        <button onclick="window.editInvoice(${inv.id})" title="Editar/Ver" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="edit" class="h-4 w-4 text-blue-600"></i></button>
                        ${inv.status !== 'Borrador' ? `<button onclick="window.generateInvoicePDF(${inv.id})" title="Descargar PDF" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="printer" class="h-4 w-4 text-green-600"></i></button>` : ''}
                    </td></tr>`;
            }).join('');

        tableBody.innerHTML = tableContent;
        feather.replace();
    };
    
    const renderInvoiceListView = () => {
        dom.invoiceListView.innerHTML = `
            <header class="mb-6 text-center relative">
                <div class="flex justify-center items-center gap-2">
                    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Facturación</h1>
                    <button id="open-settings-btn" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Configuración"><i data-feather="settings"></i></button>
                </div>
                <p class="text-gray-600 dark:text-gray-400 mt-2">Crea, gestiona y haz seguimiento de tus facturas de venta.</p>
                 <div class="absolute top-0 right-0 flex items-center h-full">
                    <button id="theme-toggle" title="Cambiar Tema"><div id="theme-toggle-circle"></div></button>
                </div>
            </header>
            <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div class="flex items-center gap-2 flex-grow">
                    <input type="text" id="invoice-search-input" placeholder="Buscar por cliente o FV..." class="border rounded-md p-2 dark:bg-gray-700 w-full sm:w-auto flex-grow">
                    <select id="status-filter" class="border rounded-md p-2 dark:bg-gray-700">
                        <option value="Todos">Todos los Estados</option>
                        <option value="Borrador">Borrador</option>
                        <option value="Emitida">Emitida</option>
                        <option value="Vencida">Vencida</option>
                        <option value="Pagada">Pagada</option>
                    </select>
                </div>
                <button id="add-invoice-btn" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-700 flex items-center transition-all flex-shrink-0"><i data-feather="plus" class="mr-2"></i>Crear Factura</button>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"><div class="overflow-x-auto"><table class="w-full table-auto">
                <thead class="bg-gray-50 dark:bg-gray-700"><tr>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase">Factura #</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Cliente</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase">F. Emisión</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Total</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase">Estado</th><th class="px-6 py-3 text-right text-xs font-medium uppercase">Acciones</th>
                </tr></thead><tbody class="divide-y divide-gray-200 dark:divide-gray-700"></tbody>
            </table></div></div>`;
        
        document.getElementById('add-invoice-btn').addEventListener('click', () => { editingId = null; currentView = 'editor'; render(); });
        document.getElementById('open-settings-btn').addEventListener('click', openSettingsModal);
        
        const searchInput = document.getElementById('invoice-search-input');
        const statusFilter = document.getElementById('status-filter');
        searchInput.value = state.filters.search;
        statusFilter.value = state.filters.status;

        searchInput.addEventListener('input', (e) => { state.filters.search = e.target.value; renderInvoiceTable(); });
        statusFilter.addEventListener('change', (e) => { state.filters.status = e.target.value; renderInvoiceTable(); });

        renderInvoiceTable();
    };

    const renderInvoiceEditorView = (invoiceId) => {
        const invoice = invoiceId ? facturacionData.invoices.find(i => i.id == invoiceId) : {};
        const isEditable = !invoiceId || invoice.status === 'Borrador';
        const defaultIssueDate = new Date().toISOString().slice(0, 10);
        const defaultDueDate = new Date(); defaultDueDate.setDate(defaultDueDate.getDate() + config.paymentTermsDays);
        const defaultDueDateStr = defaultDueDate.toISOString().slice(0, 10);
        const clientOptions = clientsData.map(c => `<option value="${c.id}" ${invoice?.clientId == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
        
        dom.invoiceEditorView.innerHTML = `
            <div class="flex justify-between items-center mb-4"><button id="back-to-list-btn" class="flex items-center text-blue-600 hover:underline"><i data-feather="arrow-left" class="mr-2"></i>Volver a la Lista</button></div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <div class="grid md:grid-cols-2 gap-8 mb-8"><div><h2 class="text-2xl font-bold">FACTURA DE VENTA</h2><span class="text-gray-500 dark:text-gray-400">FV-${invoice?.invoiceNumber || (facturacionData.lastInvoiceNumber + 1)}</span></div><div class="text-left md:text-right"><p class="font-bold">${config.company.name}</p><p class="text-sm text-gray-600 dark:text-gray-300">NIT: ${config.company.nit}</p></div></div>
                <div class="grid md:grid-cols-2 gap-8 mb-8 border-t dark:border-gray-700 pt-6">
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-sm font-medium">Cliente</label>
                            ${isEditable ? `<label class="flex items-center text-sm"><input type="checkbox" id="pos-client-checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"><span class="ml-2 text-gray-600 dark:text-gray-400">Venta a Cliente Final</span></label>` : ''}
                        </div>
                        ${isEditable ? `<select id="inv-client" class="w-full border rounded p-2 dark:bg-gray-700"><option value="">Seleccione un cliente...</option>${clientOptions}</select>` : `<p class="font-semibold text-lg py-2">${invoice.clientName || 'N/A'}</p>`}
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-sm font-medium mb-1">Fecha Emisión</label><input type="date" id="inv-issue-date" value="${invoice?.issueDate || defaultIssueDate}" class="w-full border rounded p-2 dark:bg-gray-700" ${!isEditable ? 'disabled' : ''}></div>
                        <div><label class="block text-sm font-medium mb-1">Fecha Vencimiento</label><input type="date" id="inv-due-date" value="${invoice?.dueDate || defaultDueDateStr}" class="w-full border rounded p-2 dark:bg-gray-700" ${!isEditable ? 'disabled' : ''}></div>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full table-auto"><thead class="bg-gray-50 dark:bg-gray-700"><tr><th class="p-2 text-left text-xs uppercase">Producto</th><th class="p-2 text-left text-xs uppercase w-24">Cantidad</th><th class="p-2 text-left text-xs uppercase w-40">Precio Unit.</th><th class="p-2 text-right text-xs uppercase w-40">Total</th>${isEditable ? '<th class="w-12"></th>' : ''}</tr></thead><tbody id="inv-items-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody></table></div>
                ${isEditable && inventoryData.length > 0 ? `<button id="add-item-row-btn" class="mt-4 text-sm text-blue-600 hover:underline flex items-center"><i data-feather="plus" class="mr-1 h-4 w-4"></i>Agregar línea</button>` : ''}
                <div class="grid md:grid-cols-2 mt-8">
                    <div class="space-y-3 ${!isEditable ? 'hidden' : ''}">
                        <div class="p-3 border rounded-md dark:border-gray-600">
                           <div class="flex items-center"><input type="checkbox" id="apply-retefuente" class="h-4 w-4 rounded" ${invoice?.retefuenteRate > 0 || invoice?.retencionFuente > 0 ? 'checked' : ''}> <label for="apply-retefuente" class="ml-2 text-sm font-medium">Aplicar Retefuente</label></div>
                           <div id="retefuente-details" class="mt-2 pl-6 ${invoice?.retefuenteRate > 0 || invoice?.retencionFuente > 0 ? '' : 'hidden'}"><label class="block text-xs">Tasa (%)</label><input type="number" id="retefuente-rate" value="${(invoice?.retefuenteRate || config.RETEFUENTE_RATE) * 100}" step="0.01" class="w-full border rounded p-1 text-sm dark:bg-gray-700"></div>
                        </div>
                        <div class="p-3 border rounded-md dark:border-gray-600">
                           <div class="flex items-center"><input type="checkbox" id="apply-reteica" class="h-4 w-4 rounded" ${invoice?.reteicaRate > 0 || invoice?.retencionICA > 0 ? 'checked' : ''}> <label for="apply-reteica" class="ml-2 text-sm font-medium">Aplicar ReteICA</label></div>
                           <div id="reteica-details" class="mt-2 pl-6 ${invoice?.reteicaRate > 0 || invoice?.retencionICA > 0 ? '' : 'hidden'}"><label class="block text-xs">Tasa (por mil)</label><input type="number" id="reteica-rate" value="${(invoice?.reteicaRate || config.RETEICA_RATE) * 1000}" step="0.001" class="w-full border rounded p-1 text-sm dark:bg-gray-700"></div>
                        </div>
                    </div>
                    <div class="w-full max-w-sm ml-auto space-y-1 text-sm">
                        <div class="flex justify-between"><span>Subtotal:</span><span id="inv-subtotal">$0</span></div>
                        <div class="flex justify-between"><span>IVA (${config.IVA_RATE*100}%):</span><span id="inv-iva">$0</span></div>
                        <div class="flex justify-between font-bold text-base border-t dark:border-gray-600 mt-2 pt-2"><span>TOTAL FACTURA:</span><span id="inv-total">$0</span></div>
                        <div id="retefuente-row" class="flex justify-between text-red-600 dark:text-red-400 hidden"><span>(-) Retefuente:</span><span id="inv-retefuente">$0</span></div>
                        <div id="reteica-row" class="flex justify-between text-red-600 dark:text-red-400 hidden"><span>(-) ReteICA:</span><span id="inv-reteica">$0</span></div>
                        <div id="net-payable-row" class="flex justify-between font-bold text-lg text-green-600 dark:text-green-400 border-t-2 border-dashed dark:border-gray-500 mt-2 pt-2 hidden"><span>NETO A PAGAR:</span><span id="inv-net-payable">$0</span></div>
                    </div>
                </div>
                ${isEditable ? `<div class="flex justify-end gap-4 mt-8 border-t pt-6"><button id="save-draft-btn" class="bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600">Guardar Borrador</button><button id="open-finalize-options-btn" class="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700">Emitir Factura</button></div>` : ''}
            </div>`;
        setupInvoiceEditor(invoice, isEditable);
    };

    const setupInvoiceEditor = (invoice, isEditable) => {
        document.getElementById('back-to-list-btn').addEventListener('click', () => { currentView = 'list'; render(); });
        const itemsBody = document.getElementById('inv-items-body');
        const productOptions = inventoryData.map(p => `<option value="${p.id}" data-price="${p.salePrice}" ${p.quantity <= 0 ? 'disabled' : ''}>${p.name} (Stock: ${p.quantity})</option>`).join('');
        
        const addItemRow = (item = {}) => {
            const row = document.createElement('tr');
            if (isEditable) {
                row.innerHTML = `<td class="p-2"><select class="w-full border rounded p-1 dark:bg-gray-700 item-product"><option value="">Seleccionar...</option>${productOptions}</select></td><td class="p-2"><input type="number" value="${item.quantity || 1}" min="1" class="w-full border rounded p-1 dark:bg-gray-700 item-quantity"></td><td class="p-2"><input type="number" value="${item.unitPrice || 0}" min="0" class="w-full border rounded p-1 dark:bg-gray-700 item-price"></td><td class="text-right p-2 item-total">${formatCurrency(item.total || 0)}</td><td class="p-2 text-center"><button type="button" class="text-red-500 remove-item-btn p-1"><i data-feather="trash-2" class="h-4 w-4"></i></button></td>`;
                row.querySelector('.item-product').value = item.productId || "";
                
                row.querySelector('.remove-item-btn').addEventListener('click', (e) => {
                    e.currentTarget.closest('tr').remove();
                    calculateTotals();
                });
            } else {
                row.innerHTML = `<td class="p-2">${item.name || 'N/A'}</td><td class="p-2">${item.quantity || 0}</td><td class="p-2">${formatCurrency(item.unitPrice || 0)}</td><td class="text-right p-2">${formatCurrency(item.total || 0)}</td>`;
            }
            itemsBody.appendChild(row);
        };
        (invoice?.items || (isEditable ? [{}] : [])).forEach(addItemRow);
        
        if (isEditable) {
            const posCheckbox = document.getElementById('pos-client-checkbox');
            const clientSelect = document.getElementById('inv-client');
            posCheckbox.addEventListener('change', (e) => {
                clientSelect.disabled = e.target.checked;
                if(e.target.checked) clientSelect.value = "";
            });

            document.getElementById('add-item-row-btn')?.addEventListener('click', () => { addItemRow(); feather.replace(); });
            itemsBody.addEventListener('change', e => { if (e.target.classList.contains('item-product')) { const price = e.target.options[e.target.selectedIndex].dataset.price || 0; e.target.closest('tr').querySelector('.item-price').value = price; } calculateTotals(); });
            itemsBody.addEventListener('input', calculateTotals);
            document.getElementById('apply-retefuente').addEventListener('change', (e) => { document.getElementById('retefuente-details').classList.toggle('hidden', !e.target.checked); calculateTotals(); });
            document.getElementById('apply-reteica').addEventListener('change', (e) => { document.getElementById('reteica-details').classList.toggle('hidden', !e.target.checked); calculateTotals(); });
            document.getElementById('retefuente-rate').addEventListener('input', calculateTotals);
            document.getElementById('reteica-rate').addEventListener('input', calculateTotals);
            document.getElementById('save-draft-btn').onclick = () => handleSave('draft');
            document.getElementById('open-finalize-options-btn').onclick = () => {
                if (document.getElementById('pos-client-checkbox').checked) { handleSave('paid'); } 
                else { dom.finalizeOptionsModal.classList.remove('hidden'); feather.replace(); }
            };
        }
        calculateTotals();
    };
    
    const calculateTotals = () => {
        let subtotal = 0;
        document.querySelectorAll('#inv-items-body tr').forEach(row => {
            const quantityInput = row.querySelector('.item-quantity');
            if (!quantityInput) return;
            const quantity = parseFloat(quantityInput.value) || 0;
            const unitPrice = parseFloat(row.querySelector('.item-price').value) || 0;
            const total = quantity * unitPrice;
            row.querySelector('.item-total').textContent = formatCurrency(total);
            subtotal += total;
        });
        const iva = subtotal * config.IVA_RATE;
        const total = subtotal + iva;
        let retencionFuente = 0, retencionICA = 0;

        if (document.getElementById('apply-retefuente')?.checked) {
            const rate = parseFloat(document.getElementById('retefuente-rate').value) / 100 || 0;
            retencionFuente = subtotal * rate;
            document.getElementById('retefuente-row').classList.remove('hidden');
        } else {
            document.getElementById('retefuente-row')?.classList.add('hidden');
        }

        if (document.getElementById('apply-reteica')?.checked) {
            const rate = parseFloat(document.getElementById('reteica-rate').value) / 1000 || 0;
            retencionICA = subtotal * rate;
            document.getElementById('reteica-row').classList.remove('hidden');
        } else {
            document.getElementById('reteica-row')?.classList.add('hidden');
        }
        const netPayable = total - retencionFuente - retencionICA;
        document.getElementById('inv-subtotal').textContent = formatCurrency(subtotal);
        document.getElementById('inv-iva').textContent = formatCurrency(iva);
        document.getElementById('inv-total').textContent = formatCurrency(total);
        document.getElementById('inv-retefuente').textContent = formatCurrency(-retencionFuente);
        document.getElementById('inv-reteica').textContent = formatCurrency(-retencionICA);
        if (retencionFuente > 0 || retencionICA > 0) {
            document.getElementById('inv-net-payable').textContent = formatCurrency(netPayable);
            document.getElementById('net-payable-row').classList.remove('hidden');
        } else {
            document.getElementById('net-payable-row')?.classList.add('hidden');
        }
    };

    const collectAndValidateInvoiceData = (isFinalizing) => {
        const isPosSale = document.getElementById('pos-client-checkbox')?.checked;
        let client = isPosSale ? { id: 0, name: 'Cliente Final' } : clientsData.find(c => c.id == document.getElementById('inv-client')?.value);
        if (!client) { showToast('Debe seleccionar un cliente o marcar como Venta a Cliente Final.', 'error'); return null; }
        
        const items = Array.from(document.querySelectorAll('#inv-items-body tr')).map(row => {
            const productSelect = row.querySelector('.item-product');
            if (!productSelect) return null;
            const product = inventoryData.find(p => p.id == productSelect.value);
            return {
                productId: product?.id, name: product?.name,
                quantity: parseFloat(row.querySelector('.item-quantity').value) || 0,
                unitPrice: parseFloat(row.querySelector('.item-price').value) || 0,
                total: (parseFloat(row.querySelector('.item-quantity').value) || 0) * (parseFloat(row.querySelector('.item-price').value) || 0),
            };
        }).filter(Boolean);
        
        if (items.length === 0) { showToast('La factura debe tener al menos un producto.', 'error'); return null; }
        if (isFinalizing) { for (const item of items) { const productInStock = inventoryData.find(p => p.id == item.productId); if (!productInStock || productInStock.quantity < item.quantity) { showToast(`Stock insuficiente para "${item.name}".`, 'error'); return null; } } }
        
        let subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const iva = subtotal * config.IVA_RATE;
        const total = subtotal + iva;
        const retefuenteRate = document.getElementById('apply-retefuente').checked ? (parseFloat(document.getElementById('retefuente-rate').value) / 100 || 0) : 0;
        const reteicaRate = document.getElementById('apply-reteica').checked ? (parseFloat(document.getElementById('reteica-rate').value) / 1000 || 0) : 0;
        const retencionFuente = subtotal * retefuenteRate;
        const retencionICA = subtotal * reteicaRate;

        return {
            id: editingId || Date.now(), clientId: client.id, clientName: client.name,
            invoiceNumber: editingId ? facturacionData.invoices.find(i => i.id == editingId).invoiceNumber : (facturacionData.lastInvoiceNumber + 1),
            issueDate: document.getElementById('inv-issue-date').value, dueDate: document.getElementById('inv-due-date').value, 
            items, subtotal, iva, total, retencionFuente, retencionICA, retefuenteRate, reteicaRate,
        };
    };

    const handleSave = (actionType) => {
        const isFinalizing = actionType !== 'draft';
        const invoiceData = collectAndValidateInvoiceData(isFinalizing);
        if (!invoiceData) return;
        
        if (editingId) {
            const index = facturacionData.invoices.findIndex(i => i.id == editingId);
            facturacionData.invoices[index] = { ...facturacionData.invoices[index], ...invoiceData };
        } else {
            invoiceData.status = 'Borrador';
            facturacionData.lastInvoiceNumber = invoiceData.invoiceNumber;
            facturacionData.invoices.push(invoiceData);
        }
        
        if (actionType === 'draft') {
            saveData();
            showToast('Borrador guardado.'); 
            currentView = 'list'; 
            render();
        } else {
            saveData();
            finalizeInvoice(invoiceData, actionType);
        }
    };
    
    const finalizeInvoice = (invoice, finalizeType) => {
        const invIndex = facturacionData.invoices.findIndex(i => i.id == invoice.id);
        if (invIndex === -1) return;

        invoice.items.forEach(item => {
            const pIndex = inventoryData.findIndex(p => p.id == item.productId);
            if (pIndex > -1) inventoryData[pIndex].quantity -= item.quantity;
        });
        localStorage.setItem('inventory', JSON.stringify(inventoryData));
        
        if (finalizeType === 'credit') {
            let debtors = JSON.parse(localStorage.getItem('debtors')) || [];
            debtors.push({
                id: Date.now(), clientId: invoice.clientId, name: invoice.clientName,
                documentType: 'Factura de Venta', invoiceNumber: `FV-${invoice.invoiceNumber}`,
                totalWithIVA: invoice.total, balance: invoice.total - invoice.retencionFuente - invoice.retencionICA,
                retencionFuente: invoice.retencionFuente, retencionICA: invoice.retencionICA,
                dueDate: invoice.dueDate, status: 'Pendiente', payments: [],
            });
            localStorage.setItem('debtors', JSON.stringify(debtors));
            facturacionData.invoices[invIndex].status = 'Emitida';
            showToast(`Factura FV-${invoice.invoiceNumber} emitida y enviada a Cobranza.`, 'success');
        } else if (finalizeType === 'paid') {
            facturacionData.invoices[invIndex].status = 'Pagada';
            showToast(`Factura FV-${invoice.invoiceNumber} registrada como Pagada.`, 'success');
        }
        
        saveData();
        currentView = 'list';
        render();
    };
    
    window.editInvoice = (id) => { editingId = id; currentView = 'editor'; render(); };
    
    window.generateInvoicePDF = (invoiceId) => {
        const inv = facturacionData.invoices.find(i => i.id == invoiceId); if (!inv) return;
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.text('FACTURA DE VENTA', 105, 20, { align: 'center' });
        doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(`FV-${inv.invoiceNumber}`, 190, 20, { align: 'right' });
        doc.setFontSize(10); doc.text(config.company.name, 20, 30); doc.text(`NIT: ${config.company.nit}`, 20, 35);
        doc.text(`Fecha Emisión: ${formatDate(inv.issueDate)}`, 190, 30, { align: 'right' }); doc.text(`Vencimiento: ${formatDate(inv.dueDate)}`, 190, 35, { align: 'right' });
        doc.rect(15, 45, 180, 20); doc.setFont('helvetica', 'bold'); doc.text('Cliente:', 20, 52); doc.setFont('helvetica', 'normal'); doc.text(inv.clientName, 40, 52);
        
        const head = [['Producto', 'Cant.', 'Precio Unit.', 'Total']];
        const body = inv.items.map(item => [item.name, item.quantity, formatCurrency(item.unitPrice), formatCurrency(item.total)]);
        doc.autoTable({ startY: 70, head: head, body: body, theme: 'grid', headStyles: { fillColor: [37, 99, 235] } });
        
        let finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text('Subtotal:', 140, finalY); doc.text(formatCurrency(inv.subtotal), 190, finalY, { align: 'right' });
        doc.text(`IVA (${(config.IVA_RATE * 100).toFixed(0)}%):`, 140, finalY + 7); doc.text(formatCurrency(inv.iva), 190, finalY + 7, { align: 'right' });
        finalY += 7;
        doc.setFont(undefined, 'bold'); doc.text('TOTAL:', 140, finalY + 7); doc.text(formatCurrency(inv.total), 190, finalY + 7, { align: 'right' });
        finalY += 7;

        if (inv.retencionFuente > 0) {
            finalY += 7;
            doc.setFont(undefined, 'normal'); doc.text(`(-) Retefuente (${(inv.retefuenteRate * 100).toFixed(2)}%):`, 140, finalY); doc.text(formatCurrency(-inv.retencionFuente), 190, finalY, { align: 'right' });
        }
        if (inv.retencionICA > 0) {
            finalY += 7;
            doc.setFont(undefined, 'normal'); doc.text(`(-) ReteICA (${(inv.reteicaRate * 1000).toFixed(3)}‰):`, 140, finalY); doc.text(formatCurrency(-inv.retencionICA), 190, finalY, { align: 'right' });
        }
        if (inv.retencionFuente > 0 || inv.retencionICA > 0) {
            finalY += 7;
             doc.setFont(undefined, 'bold'); doc.text('NETO A PAGAR:', 140, finalY); doc.text(formatCurrency(inv.total - inv.retencionFuente - inv.retencionICA), 190, finalY, { align: 'right' });
        }

        doc.save(`Factura-FV-${inv.invoiceNumber}.pdf`);
    };

    const openSettingsModal = () => {
        document.getElementById('setting-retefuente').value = config.RETEFUENTE_RATE * 100;
        document.getElementById('setting-reteica').value = config.RETEICA_RATE * 1000;
        dom.settingsModal.classList.remove('hidden');
        feather.replace();
    };

    const handleSettingsSave = (e) => {
        e.preventDefault();
        config.RETEFUENTE_RATE = parseFloat(document.getElementById('setting-retefuente').value) / 100 || 0;
        config.RETEICA_RATE = parseFloat(document.getElementById('setting-reteica').value) / 1000 || 0;
        saveSettings();
        showToast('Configuración guardada.');
        dom.settingsModal.classList.add('hidden');
    };

    const init = () => {
        loadSettings();
        const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
        applyTheme(localStorage.getItem('theme') || 'light');
        document.body.addEventListener('click', e => {
            if (e.target.closest('#theme-toggle')) {
                const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                localStorage.setItem('theme', newTheme);
                applyTheme(newTheme);
            }
        });
        
        dom.finalizeOptionsModal.querySelector('#finalize-credit-btn').onclick = () => { handleSave('credit'); dom.finalizeOptionsModal.classList.add('hidden'); };
        dom.finalizeOptionsModal.querySelector('#finalize-paid-btn').onclick = () => { handleSave('paid'); dom.finalizeOptionsModal.classList.add('hidden'); };
        dom.finalizeOptionsModal.querySelector('#cancel-finalize-btn').onclick = () => dom.finalizeOptionsModal.classList.add('hidden');
        
        dom.settingsModal.querySelector('#settings-form').addEventListener('submit', handleSettingsSave);
        dom.settingsModal.querySelector('#close-settings-btn').addEventListener('click', () => dom.settingsModal.classList.add('hidden'));

        loadData();
        render();
    };
    init();
});