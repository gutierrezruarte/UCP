// --- CONFIGURACIÓN Y BASES DE DATOS LOCALES (Simulación) ---
const STORAGE_KEY = 'ingresos_registrados_ucp';
let DOTACION_DB = {}; 
let PASES_DB = {}; 
let html5QrcodeScanner = null; 
const readerId = "reader"; 

// Variables para el control del Modal
const scannerModal = new bootstrap.Modal(document.getElementById('scannerModal'));

// --- Funciones de Utilidad (showAlert) ---

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.innerHTML = alertHTML;
    setTimeout(() => {
        const alertEl = alertContainer.querySelector('.alert');
        if (alertEl) {
            const bsAlert = bootstrap.Alert.getInstance(alertEl);
            if(bsAlert) bsAlert.close();
        }
    }, 5000);
}

// --- LÓGICA DE CARGA DE EXCEL (loadDotacion, loadPases) ---

function processExcelFile(file, handlerFunction) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        handlerFunction(json);
    };
    reader.readAsArrayBuffer(file);
}

function loadDotacion() {
    const fileInput = document.getElementById('dotacionFile');
    if (!fileInput.files.length) {
        showAlert('Seleccione un archivo de Dotación.', 'warning');
        return;
    }
    
    processExcelFile(fileInput.files[0], (data) => {
        DOTACION_DB = {};
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const codigo = row[0] ? String(row[0]).trim() : null;
            const nombre = row[1] ? String(row[1]).trim() : 'AGENTE DESCONOCIDO';
            if (codigo) {
                DOTACION_DB[codigo] = nombre;
            }
        }
        showAlert(`Dotación actualizada. Total de ${Object.keys(DOTACION_DB).length} agentes cargados.`, 'success');
    });
}

function loadPases() {
    const fileInput = document.getElementById('pasesFile');
    if (!fileInput.files.length) {
        showAlert('Seleccione un archivo de Registros de Pases.', 'warning');
        return;
    }

    processExcelFile(fileInput.files[0], (data) => {
        PASES_DB = {};
        let count = 0;
        for (let i = 1; i < data.length; i++) {
            const codigo = String(data[i][0]).trim();
            if (codigo && !PASES_DB[codigo]) {
                PASES_DB[codigo] = {
                    pases_60_dias: Math.floor(Math.random() * 10) + 1, 
                    pases_15_dias: Math.floor(Math.random() * 5) + 1  
                };
                count++;
            }
        }
        document.getElementById('pases-status').textContent = `Pases de ${count} códigos cargados/simulados.`;
        showAlert('Registros de Pases (Body Scan) cargados/simulados con éxito.', 'success');
    });
}

// --- LÓGICA DE ESCANEO Y PROCESAMIENTO ---

function processCodeAndDisplayResult(code) {
    if (!code) {
        document.getElementById('scan-result').innerHTML = 'Ningún código escaneado';
        document.getElementById('scan-result').style.color = '#ffc107';
        document.getElementById('barcode_id').setAttribute('data-processed-name', '');
        return;
    }

    let scanResultEl = document.getElementById('scan-result');
    let agentName = 'PERSONA EXTERNA (DNI)';
    let pasesInfo = '';

    scanResultEl.style.color = '#ffc107'; 
    scanResultEl.innerHTML = 'Procesando código...';
    
    if (DOTACION_DB[code]) {
        agentName = DOTACION_DB[code];
        scanResultEl.style.color = 'lime'; 
        
        const pases = PASES_DB[code];
        if (pases) {
            pasesInfo = `<br>Body Scan: ${pases.pases_60_dias} (60 días) / ${pases.pases_15_dias} (15 días)`;
        } else {
            pasesInfo = `<br>Body Scan: SIN REGISTROS (Requiere Carga)`;
        }
        
        scanResultEl.innerHTML = `✅ AGENTE: <strong>${agentName}</strong>${pasesInfo}`;

    } 
    else if (code.includes('@')) {
        const dataArray = code.split('@');
        agentName = (dataArray[0] || 'N/A') + ' ' + (dataArray[1] || 'N/A');
        
        scanResultEl.style.color = 'yellow';
        scanResultEl.innerHTML = `⚠️ DNI QR: <strong>${agentName}</strong>. Registro como Externo.`;
    }
    else {
        agentName = 'CÓDIGO DESCONOCIDO';
        scanResultEl.style.color = 'red';
        scanResultEl.innerHTML = `❌ CÓDIGO/DNI NO IDENTIFICADO. Nombre: ${agentName}`;
    }
    
    document.getElementById('barcode_id').setAttribute('data-processed-name', agentName);
}


function onScanSuccess(decodedText) {
    stopScanner(); 
    scannerModal.hide(); 

    document.getElementById('barcode_id').value = decodedText;
    processCodeAndDisplayResult(decodedText);
}

function onScanError(errorMessage) {
    // Ignorado
}

function startScanner() {
    // Detenemos cualquier escaneo previo
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
    }
    
    // Aseguramos que solo inicializamos la clase una vez
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode(readerId);
    }
    
    const config = { 
        fps: 10, 
        qrbox: { width: 300, height: 200 }, 
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE, 
            Html5QrcodeSupportedFormats.CODE_39, 
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13
        ]
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error("No se pudo iniciar la cámara:", err);
        showAlert("ERROR: No se pudo iniciar la cámara. Verifique permisos.", 'danger');
        scannerModal.hide();
    });
}

function stopScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            // Limpiamos el contenido del elemento #reader al detener
            document.getElementById(readerId).innerHTML = ''; 
        }).catch(console.error);
    }
}

// --- LÓGICA DE REPORTE/LISTADO DIARIO (Sin Cambios) ---

function getReporteData() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function renderReporteListado() {
    const data = getReporteData();
    const container = document.getElementById('reporteListContainer');
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No hay registros guardados en la base de datos local.</p>';
        return;
    }
    
    data.reverse().forEach((item) => { 
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item reporte-item';
        listItem.innerHTML = `
            <div><strong>[${item.FECHA} ${item.HORA}]</strong></div>
            <div><strong>Perfil:</strong> ${item.PERFIL}</div>
            <div><strong>Código/DNI:</strong> ${item['CREDENCIAL / DNI']}</div>
            <div><strong>Nombre:</strong> ${item.NOMBRE_PROCESADO}</div>
            <div><strong>Dominio:</strong> ${item.DOMINIO || 'N/A'}</div>
        `;
        container.appendChild(listItem);
    });
}

function filterReporteListado() {
    const searchTerm = document.getElementById('reporteSearch').value.toLowerCase();
    const data = getReporteData();
    const container = document.getElementById('reporteListContainer');
    container.innerHTML = '';

    const filteredData = data.filter(item => {
        return Object.values(item).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    }).reverse();

    if (filteredData.length === 0) {
        container.innerHTML = `<p class="text-center text-warning">No se encontraron resultados para "${searchTerm}".</p>`;
        return;
    }

    filteredData.forEach(item => {
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item reporte-item';
        listItem.innerHTML = `
            <div><strong>[${item.FECHA} ${item.HORA}]</strong></div>
            <div><strong>Perfil:</strong> ${item.PERFIL}</div>
            <div><strong>Código/DNI:</strong> ${item['CREDENCIAL / DNI']}</div>
            <div><strong>Nombre:</strong> ${item.NOMBRE_PROCESADO}</div>
            <div><strong>Dominio:</strong> ${item.DOMINIO || 'N/A'}</div>
        `;
        container.appendChild(listItem);
    });
}


// --- LÓGICA DE ENVÍO DE FORMULARIO ---

function submitForm(event) {
    event.preventDefault();

    const barcodeInput = document.getElementById('barcode_id');
    const barcodeValue = barcodeInput.value.trim();
    const perfilValue = document.getElementById('list_id').value;

    if (!barcodeValue) {
        showAlert("'CREDENCIAL / DNI' es un campo obligatorio. Ingrese o escanee el código.", 'danger');
        return;
    }
    if (!perfilValue) {
        showAlert("'PERFIL' es un campo obligatorio.", 'danger');
        return;
    }
    
    processCodeAndDisplayResult(barcodeValue); 

    const formData = {
        FECHA: new Date().toLocaleDateString('es-AR'),
        HORA: new Date().toLocaleTimeString('es-AR', { hour12: false }),
        PERFIL: perfilValue,
        DOMINIO: document.getElementById('text1_id').value,
        OBSERVACIONES: document.getElementById('text2_id').value,
        'CREDENCIAL / DNI': barcodeValue,
        'NOMBRE_PROCESADO': barcodeInput.getAttribute('data-processed-name') || 'N/A',
        'DESTINO': 'Unidad de Control Penitenciario'
    };

    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    storedData.push(formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    showAlert(`✅ Ingreso registrado con éxito. Código: ${barcodeValue}.`, 'success');
    
    // Resetear la interfaz
    document.getElementById('control-form').reset();
    document.getElementById('barcode_id').value = '';
    processCodeAndDisplayResult(''); // Limpia la visualización de escaneo y deja lista la interfaz
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('control-form').addEventListener('submit', submitForm);

    document.getElementById('barcode_id').addEventListener('change', (e) => {
        processCodeAndDisplayResult(e.target.value.trim());
    });

    document.getElementById('reporteSearch').addEventListener('input', filterReporteListado);

    // Eventos del Modal de Escáner
    const modalElement = document.getElementById('scannerModal');
    
    // CORRECCIÓN CRÍTICA: Inicia el escáner cuando el modal SE MUESTRA COMPLETAMENTE
    modalElement.addEventListener('shown.bs.modal', () => {
        startScanner();
    });

    // Detiene el escáner cuando el modal se oculta (el botón de cierre llama a stopScanner())
    modalElement.addEventListener('hidden.bs.modal', () => {
        stopScanner();
    });

    console.log("Aplicación de Control General cargada. Modo oscuro activo.");
});
