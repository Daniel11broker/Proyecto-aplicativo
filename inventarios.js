document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica del menú lateral y tema ---
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

    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
    
    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
        renderAll(); // Vuelve a dibujar el dashboard para actualizar colores del gráfico
    });

    // --- SELECTORES DOM Y ESTADO GLOBAL ---
    const dom = {
        totalValue: document.getElementById('inventory-total-value'),
        skuCount: document.getElementById('inventory-sku-count'),
        lowStockCount: document.getElementById('inventory-low-stock-count'),
        turnoverRate: document.getElementById('inventory-turnover-rate'),
        stockStatusChart: document.getElementById('stock-status-chart'),
        addProductBtn: document.getElementById('add-product-btn'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        exportPdfBtn: document.getElementById('export-pdf-btn'),
        abcAnalysisBtn: document.getElementById('abc-analysis-btn'),
        profitabilityReportBtn: document.getElementById('profitability-report-btn'),
        importCsvBtn: document.getElementById('import-csv-btn'),
        csvFileInput: document.getElementById('csv-file-input'),
        tableBody: document.getElementById('inventory-table-body'),
        noDataMessage: document.getElementById('no-data-message'),
        searchInput: document.getElementById('inventory-search-input'),
        supplierFilter: document.getElementById('supplier-filter'),
        stockStatusFilter: document.getElementById('stock-status-filter'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        paginationControls: document.getElementById('pagination-controls'),
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        bulkActions: {
            container: document.getElementById('bulk-actions-container'),
            counter: document.getElementById('bulk-actions-counter'),
            deleteBtn: document.getElementById('bulk-delete-btn'),
        },
        modals: {
            product: document.getElementById('product-modal'),
            adjustment: document.getElementById('adjustment-modal'),
            history: document.getElementById('history-modal'),
            barcode: document.getElementById('barcode-modal'),
            abcAnalysis: document.getElementById('abc-analysis-modal'),
            profitability: document.getElementById('profitability-report-modal'),
            imagePreview: document.getElementById('image-preview-modal'),
        },
    };

    let state = {
        inventory: [],
        movements: [],
        suppliers: [],
        editingProductId: null,
        stockStatusChartInstance: null,
        filters: { search: '', supplier: '', status: '' },
        sorting: { by: 'name', order: 'asc' },
        pagination: { currentPage: 1, itemsPerPage: 10, totalItems: 0, },
        selectedItems: new Set(),
    };

    // --- LÓGICA DE DATOS ---
    const saveData = () => {
        localStorage.setItem('inventory', JSON.stringify(state.inventory));
        localStorage.setItem('inventory_movements', JSON.stringify(state.movements));
    };
    const loadData = () => {
        state.inventory = JSON.parse(localStorage.getItem('inventory')) || [];
        state.movements = JSON.parse(localStorage.getItem('inventory_movements')) || [];
        state.suppliers = (JSON.parse(localStorage.getItem('compras_data_v1')) || { suppliers: [] }).suppliers;
    };
    
    // --- UTILIDADES ---
    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    
    const showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toast-container');
        const toastId = 'toast-' + Date.now();
        const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
        const icons = { success: 'check-circle', error: 'alert-triangle', info: 'info' };
        const toastElement = document.createElement('div');
        toastElement.id = toastId;
        toastElement.className = `toast ${colors[type]} text-white py-3 px-5 rounded-lg shadow-lg flex items-center gap-3`;
        toastElement.innerHTML = `<i data-feather="${icons[type]}" class="h-5 w-5"></i><span>${message}</span>`;
        toastContainer.appendChild(toastElement);
        feather.replace();
        setTimeout(() => toastElement.classList.add('show'), 10);
        setTimeout(() => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 500); }, 4000);
    };

    const toggleModal = (modalEl, show) => {
        if (show) {
            modalEl.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            modalEl.addEventListener('click', closeModalOnBackdropClick);
        } else {
            modalEl.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            modalEl.removeEventListener('click', closeModalOnBackdropClick);
        }
    };
    
    const closeModalOnBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            toggleModal(e.target, false);
        }
    };

    const getStockStatusInfo = (p) => {
        if (p.quantity <= 0) return { key: 'out_of_stock', html: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">Agotado</span>' };
        if (p.quantity <= p.reorderPoint) return { key: 'reorder', html: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">Pedir</span>' };
        if (p.quantity <= p.lowStockThreshold) return { key: 'low_stock', html: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">Stock Bajo</span>' };
        return { key: 'in_stock', html: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">En Stock</span>' };
    };
    
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- RENDERIZADO PRINCIPAL ---
    const renderAll = () => {
        renderDashboard();
        populateSupplierFilter();
        renderTable();
        feather.replace();
    };

    // --- RENDERIZADO DE COMPONENTES ---
    const renderDashboard = () => {
        let totalValue = 0, lowStockCount = 0, costOfGoodsSold = 0;
        const statusCounts = { in_stock: 0, low_stock: 0, reorder: 0, out_of_stock: 0 };

        state.inventory.forEach(p => {
            totalValue += (p.salePrice || 0) * (p.quantity || 0);
            if (p.quantity <= p.lowStockThreshold && p.quantity > 0) lowStockCount++;
            statusCounts[getStockStatusInfo(p).key]++;
        });

        state.movements.forEach(m => {
            if (m.type === 'Venta' || (m.type === 'Ajuste Manual' && m.quantityChange.startsWith('-'))) {
                const product = state.inventory.find(p => p.id === m.productId);
                if (product) {
                    const quantitySold = Math.abs(parseInt(m.quantityChange));
                    costOfGoodsSold += (product.costPrice || 0) * quantitySold;
                }
            }
        });

        const averageInventoryValue = totalValue > 0 ? totalValue / 2 : 0;
        const turnoverRate = averageInventoryValue > 0 ? costOfGoodsSold / averageInventoryValue : 0;

        dom.totalValue.textContent = formatCurrency(totalValue);
        dom.skuCount.textContent = state.inventory.length;
        dom.lowStockCount.textContent = lowStockCount;
        dom.turnoverRate.textContent = turnoverRate.toFixed(2);
        renderStockStatusChart(statusCounts);
    };
    
    const renderStockStatusChart = (statusCounts) => {
        const ctx = dom.stockStatusChart.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e5e7eb' : '#374151';
        
        const chartData = {
            labels: ['En Stock', 'Stock Bajo', 'Pedir', 'Agotado'],
            datasets: [{
                data: [statusCounts.in_stock, statusCounts.low_stock, statusCounts.reorder, statusCounts.out_of_stock],
                backgroundColor: ['#22C55E', '#FBBF24', '#F97316', '#EF4444'],
                borderColor: isDark ? '#1f2937' : '#fff',
                borderWidth: 2,
            }]
        };
        
        if (state.stockStatusChartInstance) {
            state.stockStatusChartInstance.data = chartData;
            state.stockStatusChartInstance.options.plugins.legend.labels.color = textColor;
            state.stockStatusChartInstance.options.borderColor = isDark ? '#1f2937' : '#fff';
            state.stockStatusChartInstance.update();
        } else {
            state.stockStatusChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: chartData,
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, padding: 15 } }, tooltip: { bodyFont: { size: 14 } } },
                    cutout: '60%'
                }
            });
        }
    };
    
    // El resto de la lógica de renderizado, modales, eventos, etc., se ha copiado y pegado
    // de la versión original, ya que es funcional y robusta. Solo se han hecho
    // pequeños ajustes para funcionar con el nuevo esquema de tema oscuro.
    // ... Todo el código restante va aquí
    const populateSupplierFilter = () => {
        const currentVal = dom.supplierFilter.value;
        dom.supplierFilter.innerHTML = '<option value="">Todos los proveedores</option>';
        state.suppliers.forEach(s => {
            dom.supplierFilter.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
        dom.supplierFilter.value = currentVal;
    };
    
    const renderTable = () => {
        // 1. Filtrar
        let filteredInventory = state.inventory.filter(p => {
            const status = getStockStatusInfo(p).key;
            const matchesSearch = p.name.toLowerCase().includes(state.filters.search) || p.sku.toLowerCase().includes(state.filters.search);
            const matchesSupplier = !state.filters.supplier || p.supplierId == state.filters.supplier;
            const matchesStatus = !state.filters.status || status === state.filters.status;
            return matchesSearch && matchesSupplier && matchesStatus;
        });

        // 2. Ordenar
        filteredInventory.sort((a, b) => {
            const valA = a[state.sorting.by] || '';
            const valB = b[state.sorting.by] || '';
            const order = state.sorting.order === 'asc' ? 1 : -1;
            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * order;
            }
            return (valA - valB) * order;
        });

        // 3. Paginar
        state.pagination.totalItems = filteredInventory.length;
        const start = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
        const end = start + state.pagination.itemsPerPage;
        const paginatedInventory = filteredInventory.slice(start, end);

        // 4. Renderizar
        dom.tableBody.innerHTML = '';
        if (paginatedInventory.length === 0) {
            dom.noDataMessage.innerHTML = `<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                <h3 class="mt-2 text-sm font-semibold">No hay productos</h3>
                <p class="mt-1 text-sm text-gray-500">${state.inventory.length > 0 ? 'Ningún producto coincide con tu búsqueda.' : 'Empieza agregando tu primer producto.'}</p>`;
            dom.noDataMessage.classList.remove('hidden');
        } else {
            dom.noDataMessage.classList.add('hidden');
        }

        paginatedInventory.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = `hover:bg-gray-50 dark:hover:bg-gray-700/50 ${state.selectedItems.has(p.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`;
            let expiryStatus = '';
            
            if (p.expiryDate) {
                const daysUntilExpiry = (new Date(p.expiryDate) - new Date()) / (1000 * 3600 * 24);
                if (daysUntilExpiry <= 0) expiryStatus = `<div class="text-xs text-red-500 font-bold">Vencido</div>`;
                else if (daysUntilExpiry <= 30) expiryStatus = `<div class="text-xs text-yellow-500">Vence pronto</div>`;
            }

            tr.innerHTML = `
                <td class="px-4 py-3 text-center"><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${state.selectedItems.has(p.id) ? 'checked' : ''}></td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <img src="${p.image || 'https://via.placeholder.com/40'}" alt="${p.name}" class="h-10 w-10 rounded-md object-cover cursor-pointer product-image" data-id="${p.id}">
                        <div>
                            <div class="font-medium">${p.name}</div>
                            <div class="text-sm text-gray-500">SKU: ${p.sku}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">${p.location || 'N/A'}</td>
                <td class="px-6 py-4">${formatCurrency(p.salePrice)}</td>
                <td class="px-6 py-4 font-bold">${p.quantity}</td>
                <td class="px-6 py-4">${getStockStatusInfo(p).html}${expiryStatus}</td>
                <td class="px-6 py-4 text-right flex justify-end gap-1">
                    <button class="action-btn text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" data-action="barcode" data-id="${p.id}" title="Generar Código de Barras"><i data-feather="grid"></i></button>
                    <button class="action-btn text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" data-action="adjust" data-id="${p.id}" title="Ajustar Stock"><i data-feather="sliders"></i></button>
                    <button class="action-btn text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" data-action="history" data-id="${p.id}" title="Ver Movimientos"><i data-feather="list"></i></button>
                    <button class="action-btn text-blue-600 p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50" data-action="edit" data-id="${p.id}" title="Editar"><i data-feather="edit-2"></i></button>
                    <button class="action-btn text-red-600 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" data-action="delete" data-id="${p.id}" title="Eliminar"><i data-feather="trash-2"></i></button>
                </td>`;
            dom.tableBody.appendChild(tr);
        });
        
        renderPagination();
        updateSortHeaders();
        updateBulkActionsUI();
        feather.replace();
    };
    
    const renderPagination = () => {
        const { currentPage, itemsPerPage, totalItems } = state.pagination;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPages <= 1) {
            dom.paginationControls.innerHTML = '';
            return;
        }

        let html = `<div class="text-sm text-gray-600 dark:text-gray-400">Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a ${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems} productos</div>`;
        html += '<div class="flex items-center gap-1">';
        
        const prevDisabled = currentPage === 1 ? 'disabled class="text-gray-400 cursor-not-allowed px-3 py-1"' : 'class="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md px-3 py-1"';
        html += `<button data-page="${currentPage - 1}" ${prevDisabled}><i class="h-4 w-4" data-feather="chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                html += `<button class="bg-blue-600 text-white rounded-md px-3 py-1 font-semibold">${i}</button>`;
            } else {
                html += `<button data-page="${i}" class="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md px-3 py-1">${i}</button>`;
            }
        }

        const nextDisabled = currentPage === totalPages ? 'disabled class="text-gray-400 cursor-not-allowed px-3 py-1"' : 'class="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md px-3 py-1"';
        html += `<button data-page="${currentPage + 1}" ${nextDisabled}><i class="h-4 w-4" data-feather="chevron-right"></i></button>`;
        
        html += '</div>';
        dom.paginationControls.innerHTML = html;
        feather.replace();
    };
    
    const updateSortHeaders = () => {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === state.sorting.by) {
                th.classList.add(state.sorting.order === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    };

    const updateBulkActionsUI = () => {
        const selectedCount = state.selectedItems.size;
        if (selectedCount > 0) {
            dom.bulkActions.container.classList.remove('hidden');
            dom.bulkActions.counter.innerHTML = `<span class="font-semibold">${selectedCount} producto(s) seleccionado(s).</span>`;
        } else {
            dom.bulkActions.container.classList.add('hidden');
        }
        dom.selectAllCheckbox.checked = selectedCount > 0 && selectedCount === (document.querySelectorAll('.row-checkbox').length);
    };

    const openProductModal = (product = null) => {
        state.editingProductId = product ? product.id : null;
        
        const supplierOptions = state.suppliers.map(s => `<option value="${s.id}" ${product?.supplierId == s.id ? 'selected' : ''}>${s.name}</option>`).join('');

        dom.modals.product.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 md:max-w-2xl mx-auto rounded-lg shadow-xl z-50">
                <div class="py-4 text-left px-6">
                    <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600">
                        <p class="text-2xl font-bold">${product ? "Editar" : "Agregar"} Producto</p>
                        <button class="close-modal-btn cursor-pointer z-50 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="x"></i></button>
                    </div>
                    <form id="product-form" class="mt-4 max-h-[80vh] overflow-y-auto pr-2 space-y-4">
                        <div class="flex items-center gap-4">
                            <img id="image-preview" src="${product?.image || 'https://via.placeholder.com/100'}" class="h-24 w-24 rounded-lg object-cover">
                            <div>
                                <label class="block text-sm font-medium">Imagen del Producto</label>
                                <input type="file" name="image" class="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100" accept="image/*">
                            </div>
                        </div>
                        <input type="hidden" name="id" value="${product?.id || ''}">
                        <div><label class="block text-sm font-medium">Nombre del Producto</label><input type="text" name="name" value="${product?.name || ''}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required></div>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div><label class="block text-sm font-medium">SKU (Código Único)</label><input type="text" name="sku" value="${product?.sku || ''}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required></div>
                            <div><label class="block text-sm font-medium">Categoría</label><input type="text" name="category" value="${product?.category || ''}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"></div>
                        </div>
                        <div><label class="block text-sm font-medium">Descripción</label><textarea name="description" rows="2" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600">${product?.description || ''}</textarea></div>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div><label class="block text-sm font-medium">Precio de Costo</label><input type="number" name="costPrice" value="${product?.costPrice || 0}" step="0.01" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="0"></div>
                            <div><label class="block text-sm font-medium">Precio de Venta</label><input type="number" name="salePrice" value="${product?.salePrice || 0}" step="0.01" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="0"></div>
                        </div>
                        <div class="grid md:grid-cols-3 gap-4">
                            <div><label class="block text-sm font-medium">Cantidad</label><input type="number" name="quantity" value="${product?.quantity || 0}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="0" ${product ? 'disabled' : ''}></div>
                            <div><label class="block text-sm font-medium">Stock Bajo</label><input type="number" name="lowStockThreshold" value="${product?.lowStockThreshold || 0}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="0"></div>
                            <div><label class="block text-sm font-medium">Punto de Reorden</label><input type="number" name="reorderPoint" value="${product?.reorderPoint || 0}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="0"></div>
                        </div>
                        <div class="border-t dark:border-gray-700 pt-4 space-y-4">
                            <h4 class="text-sm font-medium">Campos Avanzados (Opcional)</h4>
                             <div class="grid md:grid-cols-2 gap-4">
                                <div><label class="block text-sm font-medium">Lote</label><input type="text" name="batch" value="${product?.batch || ''}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"></div>
                                <div><label class="block text-sm font-medium">Ubicación</label><input type="text" name="location" value="${product?.location || ''}" placeholder="Ej: Bodega A, Estante 3" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"></div>
                            </div>
                            <div><label class="block text-sm font-medium">Fecha de Vencimiento</label><input type="date" name="expiryDate" value="${product?.expiryDate || ''}" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"></div>
                            <div><label class="block text-sm font-medium">Proveedor por Defecto</label><select name="supplierId" class="mt-1 block w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"><option value="">Ninguno</option>${supplierOptions}</select></div>
                        </div>
                        <div class="flex justify-end mt-6 pt-4 border-t dark:border-gray-700"><button type="button" class="close-modal-btn bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-lg mr-2">Cancelar</button><button type="submit" class="bg-blue-600 text-white py-2 px-4 rounded-lg">Guardar</button></div>
                    </form>
                </div>
            </div>`;
        
        dom.modals.product.querySelector('#product-form').addEventListener('submit', handleProductSubmit);
        dom.modals.product.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.product, false));
        dom.modals.product.querySelector('input[name="image"]').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('image-preview').src = event.target.result;
                }
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        toggleModal(dom.modals.product, true);
        feather.replace();
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const productData = {
            id: state.editingProductId || Date.now(), name: data.name, sku: data.sku, category: data.category, description: data.description,
            costPrice: parseFloat(data.costPrice), salePrice: parseFloat(data.salePrice),
            quantity: parseInt(data.quantity), lowStockThreshold: parseInt(data.lowStockThreshold), reorderPoint: parseInt(data.reorderPoint),
            batch: data.batch, expiryDate: data.expiryDate, supplierId: data.supplierId, location: data.location, image: null
        };

        if (state.inventory.some(p => p.sku.toLowerCase() === productData.sku.toLowerCase() && p.id !== productData.id)) {
            return showToast('El SKU ya existe. Debe ser único.', 'error');
        }

        const imageFile = formData.get('image');
        if (imageFile && imageFile.size > 0) {
            productData.image = await fileToBase64(imageFile);
        }

        if (state.editingProductId) {
            const index = state.inventory.findIndex(p => p.id === state.editingProductId);
            productData.quantity = state.inventory[index].quantity;
            if (!productData.image) productData.image = state.inventory[index].image;
            state.inventory[index] = productData;
            showToast('Producto actualizado con éxito');
        } else {
            state.inventory.push(productData);
            state.movements.push({
                id: Date.now(), productId: productData.id, date: new Date().toISOString().slice(0, 10),
                type: 'Creación', quantityChange: `+${productData.quantity}`, newQuantity: productData.quantity,
                reason: 'Stock Inicial'
            });
            showToast('Producto agregado con éxito');
        }
        
        saveData();
        renderAll();
        toggleModal(dom.modals.product, false);
    };

    const openImagePreviewModal = (productId) => {
        const product = state.inventory.find(p => p.id === productId);
        if (!product || !product.image) return;

        dom.modals.imagePreview.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl max-w-lg w-11/12">
                 <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-contain rounded-md max-h-[80vh]">
                 <p class="text-center font-semibold mt-2">${product.name}</p>
            </div>`;
        toggleModal(dom.modals.imagePreview, true);
    };

    const handleTableClick = (e) => {
        const target = e.target.closest('.action-btn, .row-checkbox, .product-image');
        if (!target) return;
        
        const id = parseInt(target.dataset.id);
        
        if (target.matches('.action-btn')) {
            const action = target.dataset.action;
            const product = state.inventory.find(p => p.id === id);
            
            switch (action) {
                case 'barcode': window.openBarcodeModal(product); break;
                case 'adjust': window.openAdjustmentModal(product); break;
                case 'history': window.openHistoryModal(product); break;
                case 'edit': openProductModal(product); break;
                case 'delete': handleDeleteProduct(id); break;
            }
        } else if (target.matches('.row-checkbox')) {
            if (target.checked) {
                state.selectedItems.add(id);
            } else {
                state.selectedItems.delete(id);
            }
            updateBulkActionsUI();
            target.closest('tr').classList.toggle('bg-blue-50', target.checked);
            target.closest('tr').classList.toggle('dark:bg-blue-900/20', target.checked);
        } else if (target.matches('.product-image')) {
            openImagePreviewModal(id);
        }
    };
    
    const handleDeleteProduct = (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.')) {
            state.inventory = state.inventory.filter(p => p.id !== id);
            saveData();
            renderAll();
            showToast('Producto eliminado', 'error');
        }
    };

    const handleSort = (e) => {
        const sortBy = e.currentTarget.dataset.sort;
        if (state.sorting.by === sortBy) {
            state.sorting.order = state.sorting.order === 'asc' ? 'desc' : 'asc';
        } else {
            state.sorting.by = sortBy;
            state.sorting.order = 'asc';
        }
        renderTable();
    };

    const handleFilterChange = () => {
        state.filters.search = dom.searchInput.value.toLowerCase();
        state.filters.supplier = dom.supplierFilter.value;
        state.filters.status = dom.stockStatusFilter.value;
        state.pagination.currentPage = 1;
        renderTable();
    };
    
    const setupEventListeners = () => {
        dom.addProductBtn.addEventListener('click', () => openProductModal());
        dom.abcAnalysisBtn.addEventListener('click', openAbcAnalysisModal);
        dom.profitabilityReportBtn.addEventListener('click', openProfitabilityReportModal);
        dom.searchInput.addEventListener('input', handleFilterChange);
        dom.supplierFilter.addEventListener('change', handleFilterChange);
        dom.stockStatusFilter.addEventListener('change', handleFilterChange);
        
        dom.resetFiltersBtn.addEventListener('click', () => {
            dom.searchInput.value = '';
            dom.supplierFilter.value = '';
            dom.stockStatusFilter.value = '';
            handleFilterChange();
        });

        dom.importCsvBtn.addEventListener('click', () => dom.csvFileInput.click());
        dom.csvFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleCsvImport(e.target.files[0]);
            e.target.value = null;
        });
        
        dom.exportCsvBtn.addEventListener('click', handleExportCsv);
        dom.exportPdfBtn.addEventListener('click', handleExportPdf);
        
        dom.tableBody.addEventListener('click', handleTableClick);
        document.querySelectorAll('.sortable').forEach(th => th.addEventListener('click', handleSort));

        dom.paginationControls.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.page) {
                state.pagination.currentPage = parseInt(button.dataset.page);
                renderTable();
            }
        });
        
        dom.selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            if (e.target.checked) {
                checkboxes.forEach(cb => {
                    state.selectedItems.add(parseInt(cb.dataset.id));
                    cb.checked = true;
                    cb.closest('tr').classList.add('bg-blue-50', 'dark:bg-blue-900/20');
                });
            } else {
                checkboxes.forEach(cb => {
                    state.selectedItems.delete(parseInt(cb.dataset.id));
                    cb.checked = false;
                     cb.closest('tr').classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
                });
            }
            updateBulkActionsUI();
        });
        
        dom.bulkActions.deleteBtn.addEventListener('click', () => {
            if (confirm(`¿Estás seguro de que quieres eliminar ${state.selectedItems.size} productos?`)) {
                state.inventory = state.inventory.filter(p => !state.selectedItems.has(p.id));
                saveData();
                state.selectedItems.clear();
                renderAll();
                showToast(`${state.selectedItems.size} productos eliminados`, 'error');
            }
        });
    };
    
    window.openAdjustmentModal = (product) => {
        dom.modals.adjustment.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 md:max-w-md mx-auto rounded-lg shadow-xl z-50">
                <div class="py-4 text-left px-6">
                    <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600"><p class="text-2xl font-bold">Ajustar Stock</p><button class="close-modal-btn cursor-pointer p-1"><i data-feather="x"></i></button></div>
                    <form id="adjustment-form" class="mt-4 space-y-4">
                        <p><strong>Producto:</strong> ${product.name}</p><p><strong>Stock Actual:</strong> ${product.quantity}</p>
                        <input type="hidden" name="productId" value="${product.id}">
                        <div><label class="block text-sm">Tipo de Ajuste</label><select name="type" class="mt-1 w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600"><option value="increase">Aumento</option><option value="decrease">Disminución</option></select></div>
                        <div><label class="block text-sm">Cantidad a Ajustar</label><input type="number" name="quantity" class="mt-1 w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required min="1"></div>
                        <div><label class="block text-sm">Razón</label><input type="text" name="reason" placeholder="Ej: Conteo físico" class="mt-1 w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required></div>
                        <div class="flex justify-end mt-6 pt-4 border-t dark:border-gray-700"><button type="button" class="close-modal-btn bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-lg mr-2">Cancelar</button><button type="submit" class="bg-blue-600 text-white py-2 px-4 rounded-lg">Aplicar Ajuste</button></div>
                    </form>
                </div>
            </div>`;
        dom.modals.adjustment.querySelector('#adjustment-form').addEventListener('submit', handleAdjustmentSubmit);
        dom.modals.adjustment.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.adjustment, false));
        toggleModal(dom.modals.adjustment, true);
        feather.replace();
    };

    const handleAdjustmentSubmit = (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const productId = parseInt(data.productId);
        const productIndex = state.inventory.findIndex(p => p.id === productId);
        if (productIndex > -1) {
            const oldQuantity = state.inventory[productIndex].quantity;
            const adjustmentQty = parseInt(data.quantity);
            const newQuantity = data.type === 'increase' ? oldQuantity + adjustmentQty : oldQuantity - adjustmentQty;
            state.inventory[productIndex].quantity = newQuantity;
            state.movements.push({
                id: Date.now(), productId, date: new Date().toISOString().slice(0,10), type: 'Ajuste Manual',
                quantityChange: data.type === 'increase' ? `+${adjustmentQty}` : `-${adjustmentQty}`, newQuantity, reason: data.reason
            });
            saveData(); renderAll(); toggleModal(dom.modals.adjustment, false); showToast('Stock ajustado con éxito');
        }
    };
    
    window.openHistoryModal = (product) => {
        const productMovements = state.movements.filter(m => m.productId === product.id).slice().reverse();
        let movementsHtml = '<p class="text-sm text-gray-500">No hay movimientos.</p>';
        if (productMovements.length > 0) {
            movementsHtml = `<div class="overflow-y-auto max-h-64 border dark:border-gray-600 rounded-md"><table class="w-full text-sm text-left">
                <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th class="p-2">Fecha</th><th class="p-2">Tipo</th><th class="p-2">Cambio</th><th class="p-2">Nuevo Stock</th><th class="p-2">Razón/Ref.</th></tr></thead>
                <tbody class="divide-y dark:divide-gray-600">${productMovements.map(m => `<tr><td class="p-2">${m.date}</td><td class="p-2">${m.type}</td><td class="p-2 font-bold ${m.quantityChange.startsWith('+') ? 'text-green-600' : 'text-red-600'}">${m.quantityChange}</td><td class="p-2">${m.newQuantity}</td><td class="p-2">${m.reason||''}</td></tr>`).join('')}</tbody>
            </table></div>`;
        }
        dom.modals.history.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 md:max-w-2xl mx-auto rounded-lg shadow-xl z-50"><div class="py-4 text-left px-6">
                <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600"><p class="text-2xl font-bold">Historial de Movimientos</p><button class="close-modal-btn cursor-pointer p-1"><i data-feather="x"></i></button></div>
                <div class="mt-4"><h3 class="font-bold">${product.name}</h3><p class="text-sm text-gray-500">SKU: ${product.sku}</p><div class="mt-4">${movementsHtml}</div></div>
            </div></div>`;
        dom.modals.history.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.history, false));
        toggleModal(dom.modals.history, true); feather.replace();
    };

    window.openBarcodeModal = (product) => {
        dom.modals.barcode.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 sm:max-w-sm mx-auto rounded-lg shadow-xl z-50"><div class="py-4 px-6 text-left">
                <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600"><p class="text-xl font-bold">Código de Barras</p><button class="close-modal-btn cursor-pointer p-1"><i data-feather="x"></i></button></div>
                <div class="mt-4 text-center" id="barcode-print-area"><h3 class="font-semibold">${product.name}</h3><p class="text-sm text-gray-500 mb-4">SKU: ${product.sku}</p><svg id="barcode"></svg></div>
                <div class="mt-6 flex justify-end"><button id="print-barcode-btn" class="bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center"><i data-feather="printer" class="mr-2 h-5 w-5"></i>Imprimir</button></div>
            </div></div>`;
        JsBarcode("#barcode", product.sku, { format: "CODE128",lineColor: document.documentElement.classList.contains('dark') ? '#FFF' : '#000', width: 2, height: 60, displayValue: true });
        dom.modals.barcode.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.barcode, false));
        dom.modals.barcode.querySelector('#print-barcode-btn').onclick = () => {
            const content = document.getElementById('barcode-print-area').innerHTML;
            const win = window.open('', '', 'height=400,width=600');
            win.document.write(`<html><head><title>Imprimir</title><style>body{text-align:center;font-family:sans-serif;}</style></head><body>${content}</body></html>`);
            win.document.close(); win.focus(); win.print(); win.close();
        };
        toggleModal(dom.modals.barcode, true); feather.replace();
    };
    
    const openAbcAnalysisModal = () => {
        const sorted = [...state.inventory].map(p => ({ ...p, value:p.costPrice * p.quantity })).sort((a,b) => b.value - a.value);
        const totalValue = sorted.reduce((sum, p) => sum + p.value, 0);
        let cumulativeValue = 0;
        const analysis = sorted.map(p => {
            cumulativeValue += p.value;
            const cumPercent = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;
            let category = (cumPercent <= 80) ? 'A' : (cumPercent <= 95) ? 'B' : 'C';
            return { ...p, categoryABC: category };
        });
        const categories = { A: analysis.filter(p=>p.categoryABC==='A'), B: analysis.filter(p=>p.categoryABC==='B'), C: analysis.filter(p=>p.categoryABC==='C') };
        const renderCatTable = (items, cat) => items.length === 0 ? `<p class="text-sm">No hay productos en categoría ${cat}.</p>` : `<table class="w-full text-sm mt-2"><thead class="bg-gray-100 dark:bg-gray-700"><tr><th class="p-2 text-left">Producto</th><th class="p-2 text-right">Valor</th></tr></thead><tbody class="divide-y dark:divide-gray-600">${items.map(p => `<tr><td class="p-2">${p.name}</td><td class="p-2 text-right">${formatCurrency(p.value)}</td></tr>`).join('')}</tbody></table>`;
        dom.modals.abcAnalysis.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 md:max-w-3xl mx-auto rounded-lg shadow-xl z-50"><div class="py-4 px-6">
                <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600"><p class="text-2xl font-bold">Análisis ABC</p><button class="close-modal-btn cursor-pointer p-1"><i data-feather="x"></i></button></div>
                <div class="mt-4 grid md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
                    <div><h3 class="font-bold text-lg text-green-600">Categoría A (Más Valiosos)</h3>${renderCatTable(categories.A, 'A')}</div>
                    <div><h3 class="font-bold text-lg text-yellow-600">Categoría B (Valor Intermedio)</h3>${renderCatTable(categories.B, 'B')}</div>
                    <div><h3 class="font-bold text-lg text-red-600">Categoría C (Menos Valiosos)</h3>${renderCatTable(categories.C, 'C')}</div>
                </div>
            </div></div>`;
        dom.modals.abcAnalysis.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.abcAnalysis, false));
        toggleModal(dom.modals.abcAnalysis, true); feather.replace();
    };

    const openProfitabilityReportModal = () => {
        const reportData = state.inventory.map(p => {
            const marginValue = p.salePrice - p.costPrice;
            const marginPercent = p.salePrice > 0 ? (marginValue / p.salePrice) * 100 : 0;
            return { ...p, marginValue, marginPercent };
        }).sort((a,b) => b.marginPercent - a.marginPercent);
        const rows = reportData.map(p => `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="p-2">${p.name}<div class="text-xs text-gray-500">SKU: ${p.sku}</div></td><td class="p-2 text-right">${formatCurrency(p.costPrice)}</td><td class="p-2 text-right">${formatCurrency(p.salePrice)}</td><td class="p-2 text-right font-bold text-green-700">${formatCurrency(p.marginValue)}</td><td class="p-2 text-right font-bold ${p.marginPercent > 50 ? 'text-green-600' : p.marginPercent > 20 ? 'text-yellow-600' : 'text-red-600'}">${p.marginPercent.toFixed(1)}%</td></tr>`).join('');
        dom.modals.profitability.innerHTML = `
            <div class="bg-white dark:bg-gray-800 w-11/12 md:max-w-4xl mx-auto rounded-lg shadow-xl z-50"><div class="py-4 px-6">
                <div class="flex justify-between items-center pb-3 border-b dark:border-gray-600"><p class="text-2xl font-bold">Reporte de Rentabilidad</p><button class="close-modal-btn cursor-pointer p-1"><i data-feather="x"></i></button></div>
                <div class="mt-4 max-h-[70vh] overflow-y-auto"><table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th class="p-2 text-left">Producto</th><th class="p-2 text-right">Costo</th><th class="p-2 text-right">Venta</th><th class="p-2 text-right">Margen ($)</th><th class="p-2 text-right">Margen (%)</th></tr></thead>
                    <tbody class="divide-y dark:divide-gray-600">${rows}</tbody>
                </table></div>
            </div></div>`;
        dom.modals.profitability.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => toggleModal(dom.modals.profitability, false));
        toggleModal(dom.modals.profitability, true); feather.replace();
    };
    
    const handleCsvImport = (file) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => {
            let added = 0, updated = 0;
            res.data.forEach(row => {
                if (!row.sku || !row.name) return;
                const idx = state.inventory.findIndex(p => p.sku.toLowerCase() === row.sku.toLowerCase());
                const data = { name: row.name, sku: row.sku, category: row.category||'', description: row.description||'', costPrice: parseFloat(row.costPrice)||0, salePrice: parseFloat(row.salePrice)||0, quantity: parseInt(row.quantity)||0, lowStockThreshold: parseInt(row.lowStockThreshold)||0, reorderPoint: parseInt(row.reorderPoint)||0, batch: row.batch||'', expiryDate: row.expiryDate||'', supplierId: row.supplierId||'', location: row.location||'' };
                if (idx > -1) {
                    const existing = state.inventory[idx];
                    state.inventory[idx] = { ...existing, ...data, quantity: existing.quantity }; 
                    updated++;
                } else {
                    state.inventory.push({ ...data, id: Date.now() }); added++;
                }
            });
            saveData(); renderAll(); showToast(`Importación: ${added} añadidos, ${updated} actualizados.`, 'info');
        }, error: (err) => { showToast('Error al importar CSV.', 'error'); console.error(err); }});
    };
    
    const handleExportCsv = () => {
        const csv = Papa.unparse(state.inventory);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "inventario.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportPdf = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Reporte de Inventario", 14, 16);
        doc.autoTable({
            head: [['SKU', 'Nombre', 'Ubicación', 'Precio Venta', 'Cantidad']],
            body: state.inventory.map(p => [p.sku, p.name, p.location||'N/A', formatCurrency(p.salePrice), p.quantity]),
            startY: 20
        });
        doc.save('reporte-inventario.pdf');
    };

    const init = () => {
        applyTheme(localStorage.getItem('theme') || 'light');
        loadData();
        renderAll();
        setupEventListeners();
    };
    
    init();
});
