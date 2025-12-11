// --- CONFIGURACIÓN Y BASES DE DATOS LOCALES (Simulación) ---
const STORAGE_KEY = 'ingresos_registrados_ucp';
let DOTACION_DB = {}; 
let PASES_DB = {}; 
let html5QrcodeScanner;

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
        // Cierra la alerta después de 5 segundos
        const alertEl = alertContainer.querySelector('.alert');
        if (alertEl) {
            const bsAlert = bootstrap.Alert.getInstance(alertEl);
            if(bsAlert) bsAlert.close();
        }
    }, 5000);
}

// --- LÓGICA DE CARGA DE EXCEL (loadDotacion, loadPases, processExcelFile) ---
// (Estas funciones son idénticas a la versión anterior, solo se incluye una para evitar repetición excesiva)

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
        console.log("Dotación cargada.");
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
                    pases_60_dias: Math.floor(Math.random() * 10),
                    pases_15_dias: Math.floor(Math.random() * 5)
                };
                count++;
            }
        }
        document.getElementById('pases-status').textContent = `Pases de ${count} códigos cargados/simulados.`;
        showAlert('Registros de Pases (Body Scan) cargados/simulados con éxito.', 'success');
    });
}

// --- LÓGICA DE ESCANEO Y MODAL ---

function onScanSuccess(decodedText) {
    html5QrcodeScanner.stop().catch(console.error); // Detenemos la cámara
    scannerModal.hide(); // Cerramos el modal

    document.getElementById('barcode_id').value = decodedText;
    let scanResultEl = document.getElementById('scan-result');
    let agentName = 'PERSONA EXTERNA (DNI)';
    let pasesInfo = '';
    
    // Búsqueda en Dotación
    if (DOTACION_DB[decodedText]) {
        agentName = DOTACION_DB[decodedText];
        scanResultEl.style.color = 'lime'; // Color verde para éxito
        
        const pases = PASES_DB[decodedText];
        if (pases) {
            pasesInfo = ` | Pases 60d: ${pases.pases_60_dias}, Pases 15d: ${pases.pases_15_dias}`;
        } else {
            pasesInfo = ` | SIN REGISTROS DE PASE`;
        }
        
        scanResultEl.innerHTML = `✅ AGENTE ENCONTRADO: <strong>${agentName}</strong>${pasesInfo}`;

    } 
    // Manejar DNI
    else if (decodedText.includes('@')) {
        const dataArray = decodedText.split('@');
        agentName = (dataArray[0] || 'N/A') + ' ' + (dataArray[1] || 'N/A');
        
        scanResultEl.style.color = 'yellow';
        scanResultEl.innerHTML = `⚠️ DNI QR: <strong>${agentName}</strong>. Registro como Externo.`;
    }
    // Código desconocido
    else {
        agentName = 'CÓDIGO DESCONOCIDO';
        scanResultEl.style.color = 'red';
        scanResultEl.innerHTML = `❌ CÓDIGO NO IDENTIFICADO. Nombre: ${agentName}`;
    }
    
    document.getElementById('barcode_id').setAttribute('data-processed-name', agentName);
}

function onScanError(errorMessage) {
    // Esto se ejecuta constantemente. Lo ignoramos.
}

function startScanner() {
    // Si el escáner ya fue inicializado y está corriendo, lo detenemos primero para reiniciarlo
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
    }
    
    const config = { 
        fps: 10, 
        qrbox: { width: 300, height: 200 }, // Ajuste para el modal
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE, 
            Html5QrcodeSupportedFormats.CODE_39, 
            Html5QrcodeSupportedFormats.CODE_128 
        ]
    };

    // La instancia debe ser creada cada vez que se usa un nuevo elemento DOM (aunque es el mismo ID, es buena práctica)
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
    }

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

function stopScannerAndResume() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
        // Opcional: limpiar la visualización
        document.getElementById('reader').innerHTML = ''; 
    }
}

// --- LÓGICA DE ENVÍO DE FORMULARIO ---

function submitForm(event) {
    event.preventDefault();

    const barcodeValue = document.getElementById('barcode_id').value;
    const perfilValue = document.getElementById('list_id').value;

    if (!barcodeValue) {
        showAlert("'CREDENCIAL / DNI' es un campo obligatorio. Escanee el código.", 'danger');
        return;
    }
    if (!perfilValue) {
        showAlert("'PERFIL' es un campo obligatorio.", 'danger');
        return;
    }

    // Recoger datos
    const formData = {
        FECHA: new Date().toLocaleDateString('es-AR'),
        HORA: new Date().toLocaleTimeString('es-AR', { hour12: false }),
        PERFIL: perfilValue,
        DOMINIO: document.getElementById('text1_id').value,
        OBSERVACIONES: document.getElementById('text2_id').value,
        'CREDENCIAL / DNI': barcodeValue,
        'NOMBRE_PROCESADO': document.getElementById('barcode_id').getAttribute('data-processed-name') || 'N/A',
        'DESTINO': 'Unidad de Control Penitenciario'
    };

    // Guardar en la base de datos local (simulada)
    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    storedData.push(formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    showAlert(`✅ Ingreso registrado con éxito. Registros totales: ${storedData.length}.`, 'success');
    
    // Resetear la interfaz
    document.getElementById('control-form').reset();
    document.getElementById('barcode_id').value = '';
    document.getElementById('scan-result').innerHTML = 'Ningún código escaneado';
    document.getElementById('scan-result').style.color = '#ffc107';
}


// --- Inicialización y Event Listeners del Modal ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Establecer Event Listener para el formulario
    document.getElementById('control-form').addEventListener('submit', submitForm);

    // 2. Eventos para iniciar y detener el escáner con el modal de Bootstrap
    const modalElement = document.getElementById('scannerModal');
    
    // Inicia el escáner cuando el modal se muestra
    modalElement.addEventListener('shown.bs.modal', () => {
        startScanner();
    });

    // Detiene el escáner cuando el modal se oculta (ej: al hacer clic fuera o cerrar)
    modalElement.addEventListener('hidden.bs.modal', () => {
        stopScannerAndResume();
    });

    console.log("Aplicación de Control General cargada. Lista para escanear.");
});
