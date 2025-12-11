// --- CONFIGURACIÓN Y BASES DE DATOS LOCALES (Simulación) ---
const STORAGE_KEY = 'ingresos_registrados_ucp';
let DOTACION_DB = {}; 
let PASES_DB = {}; 
let html5QrcodeScanner = null; 
const readerId = "reader"; 

// Lista estática de perfiles (para el nuevo modal)
const PERFILES_LIST = [
    "PERSONAL", "MOVIL", "MONOTRIBUTISTA", "DOCENTE", "ABOGADO", 
    "PASTORAL", "CANTINA", "PROVEEDORES", "OBRA", "VISITA", "CPA", "OTROS"
];

// Variables para el control del Modal
const scannerModal = new bootstrap.Modal(document.getElementById('scannerModal'));
const perfilModal = new bootstrap.Modal(document.getElementById('perfilModal'));


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

// --- LÓGICA DE PERFILES (NUEVA) ---

function loadPerfilOptions() {
    const container = document.getElementById('perfilOptionsContainer');
    container.innerHTML = '';
    
    // Generar botones de radio grandes
    PERFILES_LIST.forEach(perfil => {
        const inputId = `perfil_radio_${perfil}`;
        
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="radio" name="perfil_option" id="${inputId}" value="${perfil}" class="perfil-radio-input">
            <label for="${inputId}" class="perfil-radio-label">${perfil}</label>
        `;
        container.appendChild(div);
    });

    // Agregar listener a los nuevos inputs
    container.querySelectorAll('.perfil-radio-input').forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                // 1. Guardar valor real en el campo oculto
                document.getElementById('list_id').value = this.value;
                // 2. Mostrar valor en el campo visible
                document.getElementById('perfil_display').value = this.value;
                // 3. Cerrar el modal
                perfilModal.hide();
            }
        });
    });

    // Restaurar selección previa si existe
    const currentPeril = document.getElementById('list_id').value;
    if (currentPeril) {
        const currentInput = document.getElementById(`perfil_radio_${currentPeril}`);
        if (currentInput) {
            currentInput.checked = true;
        }
    }
}


// --- LÓGICA DE CARGA DE EXCEL (omito cuerpos para brevedad) ---

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
        document.getElementById('barcode_id').setAttribute('data-is-agent', 'false');
        return;
    }

    let scanResultEl = document.getElementById('scan-result');
    let agentName = 'PERSONA EXTERNA (DNI)';
    let pasesInfo = '';
    let isAgent = false; 

    scanResultEl.style.color = '#ffc107'; 
    scanResultEl.innerHTML = 'Procesando código...';
    
    if (DOTACION_DB[code]) {
        // AGENTE (Credencial)
        isAgent = true;
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
        // OTROS (DNI QR) - CORRECCIÓN: Reemplazar @ por <br>
        isAgent = false;
        const dataArray = code.split('@');
        agentName = (dataArray[0] || 'N/A') + ' ' + (dataArray[1] || 'N/A');
        
        scanResultEl.style.color = 'yellow';
        
        // Mostrar datos del DNI con saltos de línea
        const formattedDNI = code.replace(/@/g, '<br>');
        scanResultEl.innerHTML = `⚠️ DNI QR:<br><small>${formattedDNI}</small><br>Registro como Externo.`;
    }
    else {
        // OTROS (Carga Manual o Código Desconocido)
        isAgent = false;
        agentName = 'CÓDIGO DESCONOCIDO';
        scanResultEl.style.color = 'red';
        scanResultEl.innerHTML = `❌ CÓDIGO/DNI NO IDENTIFICADO. Nombre: ${agentName}`;
    }
    
    document.getElementById('barcode_id').setAttribute('data-processed-name', agentName);
    document.getElementById('barcode_id').setAttribute('data-is-agent', isAgent ? 'true' : 'false');
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
    
    // Inicializar la instancia si no existe
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
        html5QrcodeScanner = null; 
        showAlert("ERROR: No se pudo iniciar la cámara. Verifique permisos.", 'danger');
        scannerModal.hide();
    });
}

function stopScanner() {
    // CORRECCIÓN: Manejo de detención más limpio
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            // Limpiamos el contenido del elemento #reader al detener
            document.getElementById(readerId).innerHTML = ''; 
        }).catch(console.error);
    }
}


// --- LÓGICA DE REPORTE/LISTADO DIARIO (Generación de Tablas) ---

function getReporteData() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function generateReportTableHTML(data, title) {
    if (data.length === 0) {
        return `<p class="text-secondary">No hay ${title} registrados.</p>`;
    }

    let html = `
        <table class="table table-dark table-striped table-hover custom-table" style="font-size: 0.9rem;">
            <thead>
                <tr>
                    <th>Hora</th>
                    <th>Código/DNI</th>
                    <th>Nombre</th>
                    <th>Perfil</th>
                    <th>Dominio</th>
                    <th>Obs.</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        const rawCode = item['CREDENCIAL / DNI'];
        // Si es DNI QR, muestra solo 'DNI QR' en la tabla (o el nombre si se procesó)
        const displayCode = rawCode.includes('@') ? 'DNI QR' : rawCode;
        
        html += `
            <tr>
                <td>${item.HORA}</td>
                <td>${displayCode}</td>
                <td>${item.NOMBRE_PROCESADO}</td>
                <td>${item.PERFIL}</td>
                <td>${item.DOMINIO || '-'}</td>
                <td>${item.OBSERVACIONES || '-'}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    return html;
}


function renderReporteListado() {
    const data = getReporteData();
    document.getElementById('reporteSearch').value = ''; 
    filterReporteListado(data);
}

function filterReporteListado() {
    const searchTerm = document.getElementById('reporteSearch').value.toLowerCase();
    const data = getReporteData().reverse(); 

    const filteredData = data.filter(item => {
        return Object.values(item).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    // Separar los datos filtrados en dos grupos
    const agentesData = filteredData.filter(item => item.IS_AGENT === 'true');
    const otrosData = filteredData.filter(item => item.IS_AGENT === 'false');
    
    // Generar las tablas y colocarlas en sus contenedores
    document.getElementById('agentesTableContainer').innerHTML = generateReportTableHTML(agentesData, 'Agentes');
    document.getElementById('otrosTableContainer').innerHTML = generateReportTableHTML(otrosData, 'Otros / Visitas');
}


// --- LÓGICA DE ENVÍO DE FORMULARIO ---

function submitForm(event) {
    event.preventDefault();

    const barcodeInput = document.getElementById('barcode_id');
    const barcodeValue = barcodeInput.value.trim();
    const perfilValue = document.getElementById('list_id').value; // Valor del campo oculto
    const perfilDisplay = document.getElementById('perfil_display').value; // Valor del campo visible

    if (!barcodeValue) {
        showAlert("'CREDENCIAL / DNI' es un campo obligatorio. Ingrese o escanee el código.", 'danger');
        return;
    }
    if (!perfilValue) {
        showAlert("'PERFIL' es un campo obligatorio. Por favor, seleccione un perfil.", 'danger');
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
        'IS_AGENT': barcodeInput.getAttribute('data-is-agent') || 'false', 
        'DESTINO': 'Unidad de Control Penitenciario'
    };

    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    storedData.push(formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    showAlert(`✅ Ingreso registrado con éxito. Código: ${barcodeValue}.`, 'success');
    
    // Resetear la interfaz
    document.getElementById('control-form').reset();
    document.getElementById('barcode_id').value = '';
    document.getElementById('list_id').value = ''; // Resetear campo oculto
    document.getElementById('perfil_display').value = ''; // Resetear campo visible
    processCodeAndDisplayResult('');
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Carga inicial de las opciones de perfil
    loadPerfilOptions();
    
    document.getElementById('control-form').addEventListener('submit', submitForm);

    document.getElementById('barcode_id').addEventListener('change', (e) => {
        processCodeAndDisplayResult(e.target.value.trim());
    });

    document.getElementById('reporteSearch').addEventListener('input', filterReporteListado);

    // Eventos del Modal de Escáner
    const modalElement = document.getElementById('scannerModal');
    
    modalElement.addEventListener('shown.bs.modal', () => {
        startScanner();
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        stopScanner();
    });
    
    // Evento del Modal de Perfil para cargar opciones si se abre (aunque lo hacemos al inicio)
    document.getElementById('perfilModal').addEventListener('shown.bs.modal', () => {
        // Aseguramos que el scroll del modal esté arriba
        document.getElementById('perfilModal').querySelector('.modal-body').scrollTop = 0;
    });

    console.log("Aplicación de Control General cargada. Modo oscuro activo.");
});
