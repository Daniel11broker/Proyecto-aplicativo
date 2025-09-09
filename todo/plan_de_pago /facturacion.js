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

    // --- Selectores DOM y Estado Global ---
    const dom = {
        documentListView: document.getElementById('document-list-view'),
        documentEditorView: document.getElementById('document-editor-view'),
        toastContainer: document.getElementById('toast-container')
    };
    
    let documentosData = {};
    let clientsData = [];
    let currentView = 'list';
    let currentDocumentType = 'invoices';
    let editingId = null;
    let state = {
        filters: { search: '' },
        tempAttachment: null
    };
    const defaultData = { 
        invoices: [], 
        creditNotes: [], 
        debitNotes: [],
        chargeAccounts: []
    };
    
    // --- Gestión de Datos (Simulando Firebase con LocalStorage) ---
    const saveData = () => {
        // En una implementación real, esta función llamaría a Firebase.
        // Ejemplo: db.collection('users').doc(userId).collection('documents')...
        localStorage.setItem('documentos_data_pro_v1', JSON.stringify(documentosData));
        console.log("Data saved (LocalStorage simulation for Pro)");
    };
    const loadData = () => {
        // En una implementación real, esta función leería de Firebase.
        const data = localStorage.getItem('documentos_data_pro_v1');
        documentosData = data ? JSON.parse(data) : JSON.parse(JSON.stringify(defaultData));
        clientsData = JSON.parse(localStorage.getItem('clients')) || [];
        if (!documentosData.chargeAccounts) documentosData.chargeAccounts = [];
    };
    
    // --- Utilidades ---
    const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
    const formatDate = (d) => { if (!d) return ''; const date = new Date(d); return new Date(date.getTime() + (date.getTimezoneOffset() * 60000)).toLocaleDateString('es-CO'); };
    const showToast = (message, type = 'success') => {
        const icon = type === 'success' ? 'check-circle' : 'alert-triangle';
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'bg-green-600' : type === 'info' ? 'bg-blue-600' : 'bg-red-600'} text-white py-3 px-5 rounded-lg shadow-lg flex items-center gap-3`;
        toast.innerHTML = `<i data-feather="${icon}" class="h-5 w-5"></i><span>${message}</span>`;
        dom.toastContainer.appendChild(toast);
        feather.replace();
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 4000);
    };
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ name: file.name, data: reader.result, type: file.type });
        reader.onerror = error => reject(error);
    });

    // --- Lógica de Renderizado ---
    const render = () => {
        loadData();
        if (currentView === 'list') {
            dom.documentListView.classList.remove('hidden');
            dom.documentEditorView.classList.add('hidden');
            renderDocumentListView();
        } else {
            dom.documentListView.classList.add('hidden');
            dom.documentEditorView.classList.remove('hidden');
            renderDocumentEditorView(editingId);
        }
        feather.replace();
    };

    const renderDocumentListView = () => {
        const docInfo = {
            invoices: { title: "Facturas de Venta" },
            chargeAccounts: { title: "Cuentas de Cobro"},
            creditNotes: { title: "Notas de Crédito" },
            debitNotes: { title: "Notas de Débito" }
        };
        const currentTitle = docInfo[currentDocumentType]?.title || "Documentos";

        dom.documentListView.innerHTML = `
            <header class="mb-6 text-center relative">
                <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Gestión de Documentos</h1>
                <p class="text-gray-600 dark:text-gray-400 mt-2">Crea y administra tus documentos comerciales.</p>
                <div class="absolute top-0 right-0 flex items-center h-full">
                    <button id="theme-toggle" title="Cambiar Tema"><div id="theme-toggle-circle"></div></button>
                </div>
            </header>
            
            <div class="mb-4 border-b border-gray-200 dark:border-gray-700">
                <nav class="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs" id="document-type-tabs">
                    <button class="document-type-tab py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap" data-type="invoices">Facturas</button>
                    <button class="document-type-tab py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap" data-type="chargeAccounts">Cuentas de Cobro</button>
                    <button class="document-type-tab py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap" data-type="creditNotes">Notas Crédito</button>
                    <button class="document-type-tab py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap" data-type="debitNotes">Notas Débito</button>
                </nav>
            </div>

            <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div class="flex items-center gap-2 flex-grow">
                    <input type="text" id="document-search-input" placeholder="Buscar por cliente o número..." class="border rounded-md p-2 dark:bg-gray-700 w-full sm:w-auto flex-grow">
                </div>
                <button id="add-document-btn" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-700 flex items-center transition-all flex-shrink-0"><i data-feather="plus" class="mr-2"></i>Crear ${currentTitle.slice(0, -1)}</button>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full table-auto">
                        <thead class="bg-gray-50 dark:bg-gray-700"><tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Documento #</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Cliente</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">F. Emisión</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Soporte</th>
                            <th class="px-6 py-3 text-right text-xs font-medium uppercase">Acciones</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700" id="document-table-body"></tbody>
                    </table>
                </div>
                 <div id="no-data-message" class="hidden text-center p-8"></div>
            </div>`;
        
        document.getElementById('add-document-btn').addEventListener('click', () => { editingId = null; currentView = 'editor'; render(); });
        document.querySelectorAll('.document-type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                currentDocumentType = e.target.dataset.type;
                renderDocumentListView();
            });
        });

        document.querySelectorAll('.document-type-tab').forEach(t => t.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300'));
        const activeTab = document.querySelector(`.document-type-tab[data-type="${currentDocumentType}"]`);
        if(activeTab){
            activeTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            activeTab.classList.add('border-blue-500', 'text-blue-600');
        }
        
        document.getElementById('document-search-input').addEventListener('input', (e) => { state.filters.search = e.target.value; renderDocumentTable(); });
        renderDocumentTable();
    };
    
    const renderDocumentTable = () => {
        const tableBody = document.getElementById('document-table-body');
        const noData = document.getElementById('no-data-message');
        if (!tableBody) return;
        
        const documents = documentosData[currentDocumentType] || [];
        const searchTerm = state.filters.search.toLowerCase();
        
        const filtered = documents.filter(doc => 
            doc.clientName.toLowerCase().includes(searchTerm) ||
            doc.number.toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            noData.classList.remove('hidden');
            noData.innerHTML = '<p class="text-gray-500">No se encontraron documentos.</p>';
            tableBody.innerHTML = '';
            return;
        }
        noData.classList.add('hidden');

        tableBody.innerHTML = filtered.slice().reverse().map(doc => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-6 py-4 font-medium">${doc.number}</td>
                <td class="px-6 py-4">${doc.clientName}</td>
                <td class="px-6 py-4">${formatDate(doc.issueDate)}</td>
                <td class="px-6 py-4">${formatCurrency(doc.total)}</td>
                <td class="px-6 py-4">${doc.attachment ? `<a href="${doc.attachment.data}" target="_blank" class="text-blue-600 hover:underline flex items-center"><i data-feather="paperclip" class="h-4 w-4 mr-1"></i>Ver</a>` : 'No'}</td>
                <td class="px-6 py-4 text-right flex justify-end gap-1">
                    <button onclick="window.editDocument('${currentDocumentType}', '${doc.id}')" title="Editar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="edit" class="h-4 w-4 text-blue-600"></i></button>
                    <button onclick="window.deleteDocument('${currentDocumentType}', '${doc.id}')" title="Eliminar" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i data-feather="trash-2" class="h-4 w-4 text-red-600"></i></button>
                </td></tr>`).join('');
        feather.replace();
    };

    const renderDocumentEditorView = (docId) => {
        state.tempAttachment = null;
        const doc = docId ? (documentosData[currentDocumentType] || []).find(d => d.id == docId) : {};

        const docInfo = {
            invoices: { title: "Factura de Venta" },
            chargeAccounts: { title: "Cuenta de Cobro"},
            creditNotes: { title: "Nota de Crédito" },
            debitNotes: { title: "Nota de Débito" }
        }[currentDocumentType];
        
        const clientOptions = clientsData.map(c => `<option value="${c.id}" ${doc?.clientId == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
        const showCobranzaOption = currentDocumentType === 'invoices' || currentDocumentType === 'chargeAccounts';

        dom.documentEditorView.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <button id="back-to-list-btn" class="flex items-center text-blue-600 hover:underline"><i data-feather="arrow-left" class="mr-2"></i>Volver</button>
            </div>
            <form id="document-form" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                 <input type="hidden" name="id" value="${doc.id || ''}">
                <h2 class="text-2xl font-bold mb-6">${docId ? 'Editar' : 'Nuevo'} ${docInfo.title}</h2>
                
                <div class="grid md:grid-cols-2 gap-6 border-t dark:border-gray-700 pt-6">
                    <div>
                        <label class="block text-sm font-medium mb-1">Cliente</label>
                        <select id="doc-client" name="clientId" class="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required>${clientOptions}</select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Número de Documento</label>
                        <input type="text" name="number" value="${doc?.number || ''}" placeholder="Ej: FV-001, CC-45" class="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Fecha Emisión</label>
                        <input type="date" name="issueDate" value="${doc?.issueDate || new Date().toISOString().slice(0,10)}" class="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Total Documento</label>
                        <input type="number" name="total" placeholder="0.00" step="0.01" class="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" value="${doc?.total || ''}" required>
                    </div>
                </div>
                
                <div class="border-t dark:border-gray-700 pt-6 mt-6">
                     <label class="block text-sm font-medium mb-2">Soporte del Documento</label>
                     <div id="attachment-area"></div>
                     <input type="file" id="file-input" class="hidden">
                </div>

                ${showCobranzaOption ? `
                <div class="border-t dark:border-gray-700 pt-6 mt-6">
                    <label class="flex items-center">
                        <input type="checkbox" name="sendToCobranza" class="h-4 w-4 rounded border-gray-300 text-blue-600">
                        <span class="ml-2 font-medium">Enviar a Cuentas por Cobrar</span>
                    </label>
                    <p class="text-xs text-gray-500 ml-6">Marque esta casilla si desea que este documento genere una cuenta pendiente en el módulo de Cobranza.</p>
                </div>` : ''}

                <div class="flex justify-end gap-4 mt-8 border-t pt-6">
                    <button type="submit" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar Documento</button>
                </div>
            </form>`;
            
        setupDocumentEditor(doc);
    };

    const setupDocumentEditor = (doc) => {
        document.getElementById('back-to-list-btn').addEventListener('click', () => { currentView = 'list'; render(); });
        document.getElementById('document-form').addEventListener('submit', handleSaveDocument);
        
        const attachmentArea = document.getElementById('attachment-area');
        const fileInput = document.getElementById('file-input');

        const renderAttachmentUI = () => {
            const attachment = state.tempAttachment || doc.attachment;
            if (attachment) {
                attachmentArea.innerHTML = `
                    <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <a href="${attachment.data}" target="_blank" class="flex items-center gap-2 text-blue-600 hover:underline">
                            <i data-feather="file-text"></i><span class="truncate">${attachment.name}</span>
                        </a>
                        <button type="button" id="remove-attachment-btn" class="text-red-500 hover:text-red-700 p-1"><i data-feather="x"></i></button>
                    </div>`;
                document.getElementById('remove-attachment-btn').onclick = () => {
                    state.tempAttachment = null;
                    doc.attachment = null;
                    renderAttachmentUI();
                };
            } else {
                attachmentArea.innerHTML = `<button type="button" id="upload-btn" class="w-full border-2 border-dashed rounded-lg p-3 text-center hover:bg-gray-50 dark:hover:bg-gray-700">
                    <i data-feather="upload-cloud" class="mx-auto h-6 w-6 text-gray-400"></i><p class="mt-1 text-xs text-gray-600">Subir un archivo</p>
                </button>`;
                document.getElementById('upload-btn').onclick = () => fileInput.click();
            }
            feather.replace();
        };

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { return showToast('El archivo es muy grande (máx 5MB).', 'error'); }
                try {
                    state.tempAttachment = await fileToBase64(file);
                    renderAttachmentUI();
                } catch (error) { showToast('Error al cargar el archivo.', 'error');}
            }
        };
        renderAttachmentUI();
    };

    // --- Lógica de Acciones y Eventos ---
    const handleSaveDocument = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const docArray = documentosData[currentDocumentType];

        const isDuplicate = docArray.some(doc => 
            doc.id != editingId &&
            doc.clientId == data.clientId &&
            doc.number.toLowerCase() === data.number.toLowerCase()
        );
        if (isDuplicate) { return showToast('El número de documento ya existe para este cliente.', 'error'); }

        let newDoc = {
            id: editingId || Date.now(),
            number: data.number,
            clientId: parseInt(data.clientId),
            clientName: clientsData.find(c => c.id == data.clientId)?.name || 'N/A',
            issueDate: data.issueDate,
            total: parseFloat(data.total),
            attachment: state.tempAttachment || (editingId ? docArray.find(d => d.id == editingId)?.attachment : null)
        };

        if (editingId) {
            const index = docArray.findIndex(d => d.id == editingId);
            docArray[index] = newDoc;
            showToast('Documento actualizado.');
        } else {
            docArray.push(newDoc);
            showToast('Documento creado con éxito.');
        }
        
        if (data.sendToCobranza === 'on') {
            let debtors = JSON.parse(localStorage.getItem('debtors')) || [];
            debtors = debtors.filter(d => d.documentoId !== newDoc.id);
            debtors.push({
                id: Date.now(), documentoId: newDoc.id, clientId: newDoc.clientId,
                documentType: currentDocumentType === 'invoices' ? 'Factura de Venta' : 'Cuenta de Cobro',
                invoiceNumber: newDoc.number, totalWithIVA: newDoc.total, balance: newDoc.total,
                dueDate: newDoc.issueDate, status: 'Pendiente', payments: []
            });
            localStorage.setItem('debtors', JSON.stringify(debtors));
            showToast('Documento enviado a cobranza.', 'info');
        }

        saveData();
        currentView = 'list';
        render();
    };

    window.editDocument = (docType, id) => {
        currentDocumentType = docType;
        editingId = id;
        currentView = 'editor';
        render();
    };
    
    window.deleteDocument = (docType, id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este documento?')) {
            documentosData[docType] = documentosData[docType].filter(d => d.id != id);
            saveData();
            render();
            showToast('Documento eliminado.');
        }
    };
    
    // --- Inicialización ---
    const init = () => {
        const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
        applyTheme(localStorage.getItem('theme') || 'light');
        document.body.addEventListener('click', e => {
            if (e.target.closest('#theme-toggle')) {
                const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                localStorage.setItem('theme', newTheme);
                applyTheme(newTheme);
            }
        });
        
        loadData();
        render();
    };
    
    init();
});