document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // --- Selectores del DOM ---
    const productList = document.getElementById('product-list');
    const cartItems = document.getElementById('cart-items');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const cartTax = document.getElementById('cart-tax');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const toastContainer = document.getElementById('toast-container');
    const applyIvaCheckbox = document.getElementById('apply-iva');

    // --- Estado de la aplicación ---
    let cart = [];
    let inventory = [];

    // --- Cargar Datos del Inventario (Robusto) ---
    const loadInventory = () => {
        try {
            const data = localStorage.getItem('inventario_data_v1');
            if (data) {
                const parsedData = JSON.parse(data);
                if (Array.isArray(parsedData)) {
                    inventory = parsedData;
                } else {
                    inventory = [];
                }
            } else {
                inventory = [];
            }
        } catch (error) {
            console.error("Error al cargar o analizar los datos del inventario:", error);
            inventory = [];
        }
    };

    // --- Utilidades ---
    const showToast = (message, type = 'success') => {
        const icon = type === 'success' ? 'check-circle' : 'alert-triangle';
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white py-3 px-5 rounded-lg shadow-lg flex items-center gap-3`;
        toast.innerHTML = `<i data-feather="${icon}" class="h-5 w-5"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        feather.replace();
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 4000);
    };

    // --- Lógica de Renderizado ---
    const renderProducts = (products) => {
        productList.innerHTML = '';
        const validProducts = products.filter(p => p && p.name && (p.stock || p.stock === 0) && (p.price || p.price === 0));

        if (validProducts.length === 0) {
            productList.innerHTML = `<p class="col-span-full text-center text-gray-500">No hay productos con stock. Agrega algunos en el módulo de Inventarios.</p>`;
            return;
        }

        validProducts.forEach(product => {
            if (parseInt(product.stock) > 0) {
                const productEl = document.createElement('div');
                productEl.className = 'p-4 border rounded-md text-center cursor-pointer hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 transition-transform hover:scale-105';
                productEl.innerHTML = `
                    <h3 class="font-semibold">${product.name}</h3>
                    <p class="text-gray-500 dark:text-gray-400">$${parseInt(product.price).toLocaleString()}</p>
                    <p class="text-xs text-gray-400">Stock: ${product.stock}</p>
                `;
                productEl.addEventListener('click', () => addToCart(product));
                productList.appendChild(productEl);
            }
        });
    };
    
    // --- Lógica del Carrito ---
    const addToCart = (product) => {
        const existingItem = cart.find(item => item.id === product.id);
        const stock = parseInt(product.stock);

        if (existingItem) {
            if (existingItem.quantity < stock) {
                existingItem.quantity++;
            } else {
                showToast(`No hay más stock para ${product.name}.`, 'error');
            }
        } else {
             if (stock > 0) {
                cart.push({ ...product, price: parseInt(product.price), quantity: 1 });
             } else {
                showToast(`${product.name} no tiene stock disponible.`, 'error');
             }
        }
        renderCart();
    };
    
    const renderCart = () => {
        cartItems.innerHTML = '';
        let subtotal = 0;

        cart.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex justify-between items-center mb-2';
            itemEl.innerHTML = `
                <div>
                    <p class="font-semibold">${item.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">$${item.price.toLocaleString()} x ${item.quantity}</p>
                </div>
                <div class="flex items-center">
                    <button class="px-2 py-1 text-sm btn-secondary remove-from-cart" data-id="${item.id}">-</button>
                    <span class="px-2">${item.quantity}</span>
                    <button class="px-2 py-1 text-sm btn-secondary add-to-cart" data-id="${item.id}">+</button>
                </div>
            `;
            cartItems.appendChild(itemEl);
            subtotal += item.price * item.quantity;
        });
        
        const taxRate = applyIvaCheckbox.checked ? 0.19 : 0;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        cartSubtotal.textContent = `$${subtotal.toLocaleString()}`;
        cartTax.textContent = `$${tax.toLocaleString()}`;
        cartTotal.textContent = `$${total.toLocaleString()}`;

        document.querySelectorAll('.remove-from-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const item = cart.find(item => item.id === id);
                if (item) {
                    item.quantity--;
                    if (item.quantity === 0) {
                        cart = cart.filter(item => item.id !== id);
                    }
                    renderCart();
                }
            });
        });
        
        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                 const id = parseInt(e.target.dataset.id, 10);
                 const productInCart = cart.find(item => item.id === id);
                 const productInInventory = inventory.find(item => item.id === id);

                 if (productInCart && productInInventory) {
                    if (productInCart.quantity < parseInt(productInInventory.stock)) {
                        productInCart.quantity++;
                        renderCart();
                    } else {
                        showToast(`No hay más stock para ${productInCart.name}.`, 'error');
                    }
                 }
            });
        });
    };
    
    // --- Event Listeners ---
    applyIvaCheckbox.addEventListener('change', renderCart);

    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            showToast('El carrito está vacío.', 'error');
            return;
        }

        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const taxRate = applyIvaCheckbox.checked ? 0.19 : 0;
        const iva = subtotal * taxRate;
        const total = subtotal + iva;
        const invoiceNumber = `POS-${Date.now()}`;

        // Actualizar el stock en el inventario
        cart.forEach(cartItem => {
            const inventoryItem = inventory.find(invItem => invItem.id === cartItem.id);
            if (inventoryItem) {
                inventoryItem.stock = parseInt(inventoryItem.stock) - cartItem.quantity;
            }
        });
        localStorage.setItem('inventario_data_v1', JSON.stringify(inventory));

        const invoiceData = {
            clientId: 1, 
            clientName: 'Cliente POS',
            number: invoiceNumber,
            issueDate: new Date().toISOString().slice(0, 10),
            subtotal: subtotal,
            iva: iva,
            total: total,
            status: 'Pagado',
            items: cart
        };
        localStorage.setItem('invoiceFromCrm', JSON.stringify(invoiceData));
        
        const transactions = JSON.parse(localStorage.getItem('transactions_v2')) || [];
        transactions.push({
            id: Date.now(),
            date: new Date().toISOString().slice(0, 10),
            description: `Venta POS #${invoiceNumber}`,
            amount: total,
            type: 'ingreso',
            category: 'Ventas'
        });
        localStorage.setItem('transactions_v2', JSON.stringify(transactions));

        showToast('¡Venta completada! Redirigiendo a facturación...', 'success');

        setTimeout(() => {
            window.location.href = 'facturacion.html';
        }, 1500);
    });

    // --- Inicialización ---
    const init = () => {
        loadInventory();
        renderProducts(inventory); // Carga y muestra todos los productos al iniciar
    };

    init();
});