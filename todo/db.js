// Archivo: db.js

// Importa la librería Dexie
import Dexie from 'https://unpkg.com/dexie@3.2.3/dist/dexie.mjs';

// Crea la base de datos y define el esquema
export const db = new Dexie('SuiteEmpresarialDB');
db.version(1).stores({
    clients: '++id, name, idNumber',
    invoices: '++id, number, clientId, clientName, issueDate, total, status',
    creditNotes: '++id, number, clientId, clientName, issueDate, total, status',
    debitNotes: '++id, number, clientId, clientName, issueDate, total, status',
    chargeAccounts: '++id, number, clientId, clientName, issueDate, total, status',
    inventory: '++id, sku, name, category, costPrice, salePrice, quantity',
    movements: '++id, productId, date, type, quantityChange, newQuantity',
    suppliers: '++id, name, nit, contactName',
    purchaseOrders: '++id, supplierId, date, status',
    bills: '++id, invoiceNumber, supplierId, date, dueDate, total, balance, status',
    tesoreriaAccounts: '++id, name, bank, type',
    tesoreriaTransactions: '++id, date, accountId, type, description, amount',
    debtors: '++id, clientId, documentType, invoiceNumber, totalWithIVA, balance, dueDate, status',
    opportunities: '++id, name, accountId, stage',
    crmAccounts: '++id, name, industry',
    crmContacts: '++id, accountId, name, role',
    leads: '++id, name, company, status',
    employees: '++id, name, idNumber, position, department, status, baseSalary',
    nominaNovelties: '++id, employeeId, period, type, concept, value',
    payrollHistory: '++id, period, records',
    sstData: '++id, section, data',
    // Nueva tabla para usuarios administradores
    admins: '++id, username, passwordHash, salt' 
});