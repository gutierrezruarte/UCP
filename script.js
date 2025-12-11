// --- CONFIGURACIÓN Y BASES DE DATOS LOCALES (Simulación) ---
const STORAGE_KEY = 'ingresos_registrados_ucp';
let DOTACION_DB = {}; // { 'codigo': 'Nombre Apellido', ... }
let PASES_DB = {}; // { 'codigo': { pases_60: N, pases_15: M }, ... }
let html5QrcodeScanner;

// --- Funciones de Utilidad ---

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.innerHTML = alertHTML;
}

// --- LÓGICA DE CARGA DE EXCEL (Dotación y Pases) ---

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
        // Asumimos que la primera fila es de encabezados y el Código/DNI está en la columna A (índice 0)
        // y el Nombre Completo está en la columna B (índice 1).
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const codigo = row[0] ? String(row[0]).trim() : null;
            const nombre = row[1] ? String(row[1]).trim() : 'AGENTE DESCONOCIDO';

            if (codigo) {
                DOTACION_DB[codigo] = nombre;
            }
        }
        showAlert(`Dotación actualizada. Total de ${Object.keys(DOTACION_DB).length} agentes cargados.`, 'success');
        console.log("Dotación cargada:", DOTACION_DB);
    });
}

function loadPases() {
    const fileInput = document.getElementById('pasesFile');
    if (!fileInput.files.length) {
        showAlert('Seleccione un archivo de Registros de Pases.', 'warning');
        return;
    }

    processExcelFile(fileInput.files[0], (data) => {
        // En un caso real, necesitarías la lógica para contar los pases por código
        // en los últimos 60 y 15 días, asumiendo que el Excel tiene las fechas.
        // Aquí SIMULAREMOS datos aleatorios para demostración.
        PASES_DB = {};
        let count = 0;

        for (let i = 1; i < data.length; i++) {
            const codigo = String(data[i][0]).trim(); // Asume código en columna A
            if (codigo && !PASES_DB[codigo]) {
                 // Simulación: Asigna pases aleatorios para la demostración
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

// --- LÓGICA DE ESCANEO Y PROCESAMIENTO ---

function onScanSuccess(decodedText) {
    html5QrcodeScanner.pause(true); // Pausamos el escáner

    document.getElementById('barcode_id').value = decodedText;
    let scanResultEl = document.getElementById('scan-result');
    let agentName = 'PERSONA EXTERNA (DNI)';
    let pasesInfo = '';
    
    // 1. Intentar buscar en la base de dotación
    if (DOTACION_DB[decodedText]) {
        agentName = DOTACION_DB[decodedText];
        scanResultEl.style.color = 'green';
        
        // 2. Verificar pases
        const pases = PASES_DB[decodedText];
        if (pases) {
            pasesInfo = ` | Pases 60d: ${pases.pases_60_dias}, Pases 15d: ${pases.pases_15_dias}`;
        } else {
            pasesInfo = ` | SIN REGISTROS DE PASE (Body Scan)`;
        }
        
        scanResultEl.innerHTML = `✅ AGENTE ENCONTRADO: <strong>${agentName}</strong>${pasesInfo}`;

    } 
    // 3. Manejar DNI (Separación de datos)
    else if (decodedText.includes('@')) {
        const dataArray = decodedText.split('@');
        agentName = (dataArray[0] || 'N/A') + ' ' + (dataArray[1] || 'N/A');
        
        // Puedes guardar los datos separados en campos ocultos si lo necesitas
        // Por ahora, solo actualizamos el resultado visible
        scanResultEl.style.color = 'orange';
        scanResultEl.innerHTML = `⚠️ DNI QR: <strong>${agentName}</strong>. Registro como VISITA/EXTERNO.`;
    }
    // 4. Código desconocido
    else {
        agentName = 'CÓDIGO DESCONOCIDO';
        scanResultEl.style.color = 'red';
        scanResultEl.innerHTML = `❌ CÓDIGO/DNI NO IDENTIFICADO. Nombre: ${agentName}`;
    }
    
    // Almacenar el nombre procesado para el envío final
    document.getElementById('barcode_id').setAttribute('data-processed-name', agentName);
}

function onScanError(errorMessage) {
    // console.log(`Error de escaneo: ${errorMessage}`);
}

function startScanner() {
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 150 }, 
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE, 
            Html5QrcodeSupportedFormats.CODE_39, 
            Html5QrcodeSupportedFormats.CODE_128 
        ]
    };

    html5QrcodeScanner = new Html5Qrcode("reader");

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error("No se pudo iniciar la cámara:", err);
        document.getElementById('scan-result').innerHTML = "ERROR: No se pudo iniciar la cámara. Verifique permisos o use un dispositivo compatible.";
        document.getElementById('scan-result').style.color = 'red';
    });
}


// --- LÓGICA DE ENVÍO DE FORMULARIO (Simulación de Envío) ---

function submitForm(event) {
    event.preventDefault();

    const barcodeValue = document.getElementById('barcode_id').value;
    const perfilValue = document.getElementById('list_id').value;

    // Validación de campos obligatorios
    if (!barcodeValue) {
        showAlert("'CREDENCIAL / DNI' es un campo obligatorio.", 'danger');
        return;
    }
    if (!perfilValue) {
        showAlert("'PERFIL' es un campo obligatorio.", 'danger');
        return;
    }

    // Recoger y estructurar los datos (simulando inputToJson)
    const formData = {
        FECHA: new Date().toLocaleDateString('es-AR'),
        HORA: new Date().toLocaleTimeString('es-AR', { hour12: false }),
        PERFIL: perfilValue,
        DOMINIO: document.getElementById('text1_id').value,
        OBSERVACIONES: document.getElementById('text2_id').value,
        'CREDENCIAL / DNI': barcodeValue,
        'NOMBRE_PROCESADO': document.getElementById('barcode_id').getAttribute('data-processed-name') || 'N/A',
        'DESTINO': 'Unidad de Control Penitenciario' // Valor fijo de tu función getSubmitOptions
    };

    // Guardar en la base de datos local (simulada)
    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    storedData.push(formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    // Mostrar éxito y restablecer formulario
    showAlert(`✅ Ingreso registrado con éxito. Registros totales: ${storedData.length}.`, 'success');
    document.getElementById('control-form').reset();
    document.getElementById('barcode_id').value = '';
    document.getElementById('scan-result').innerHTML = 'Escanee su **CREDENCIAL** (código de barras) o **DNI** (QR).';
    document.getElementById('scan-result').style.color = '#007bff';
    
    // Reanudar el escáner si estaba pausado
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.resume();
    }
}


// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Escáner
    startScanner(); 
    
    // 2. Establecer Event Listener para el formulario
    document.getElementById('control-form').addEventListener('submit', submitForm);

    // 3. Simular un permiso de modificación para el submenú (Opcional)
    // En un sistema real, esto requeriría autenticación. Aquí simplemente
    // habilitamos la carga de archivos al cargar la página.
    console.log("Sistema cargado. Use el botón 'Administrar' para cargar Excels.");
});
