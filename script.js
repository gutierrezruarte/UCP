// --- CONFIGURACIÓN Y BASES DE DATOS LOCALES (Simulación) ---
const STORAGE_KEY = 'ingresos_registrados_ucp';
let DOTACION_DB = {}; 
let PASES_DB = {}; 
let html5QrcodeScanner = null; 
const readerId = "reader"; 
let lastFilteredData = []; 

const scannerModal = new bootstrap.Modal(document.getElementById('scannerModal'));
// Referencia al botón rectangular fijo
const sendButtonRect = document.getElementById('sendButtonRect'); 


// --- Funciones de Utilidad (showAlert y Sonido) ---

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

function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine'; 
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); 
        // VOLUMEN MÁXIMO
        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime); 
        
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.warn("Web Audio API no soportada o falló al iniciar el sonido.");
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
        isAgent = false;
        const dataArray = code.split('@');
        agentName = (dataArray[0] || 'N/A') + ' ' + (dataArray[1] || 'N/A');
        
        scanResultEl.style.color = 'yellow';
        
        const formattedDNI = code.replace(/@/g, '<br>');
        scanResultEl.innerHTML = `⚠️ DNI QR:<br><small>${formattedDNI}</small><br>Registro como Externo.`;
    }
    else {
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
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
    }
    
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
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById(readerId).innerHTML = ''; 
        }).catch(console.error);
    }
}

// --- LÓGICA DE REPORTE/LISTADO DIARIO (omito cuerpos para brevedad) ---

function getReporteData() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function generateReportTableHTML(data, title) {
    let exportButtons = '';
    if (data.length > 0) {
        exportButtons = `
            <div class="d-flex justify-content-end mb-2 gap-2">
                <button class="btn btn-sm btn-info" onclick="exportarAExcel('${title}')">
                    <i class="bi bi-file-earmark-spreadsheet"></i> Exportar XLS
                </button>
                <button class="btn btn-sm btn-danger" onclick="exportarAPDF('${title}')">
                    <i class="bi bi-file-pdf"></i> Exportar PDF
                </button>
            </div>
        `;
    }

    if (data.length === 0) {
        return `<p class="text-secondary">No hay ${title} registrados.</p>`;
    }

    const isOtros = title === 'Otros';
    let headers = `
        <th>Hora</th>
        <th>Código/DNI</th>
        <th>Nombre</th>
        <th>Perfil</th>
        <th>Dominio</th>
        <th>Obs.</th>
    `;
    
    if (isOtros) {
        headers = `
            <th>Hora</th>
            <th>Nombre Completo</th>
            <th>Perfil</th>
            <th>DNI Dato 1</th>
            <th>DNI Dato 2</th>
            <th>DNI Dato 3</th>
            <th>Dominio</th>
            <th>Obs.</th>
        `;
    }

    let html = `
        ${exportButtons}
        <table class="table table-dark table-striped table-hover custom-table" id="table-${title.replace(/\s/g, '-')}" style="font-size: 0.9rem;">
            <thead>
                <tr>${headers}</tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        const rawCode = item['CREDENCIAL / DNI'];
        const displayCode = rawCode.includes('@') ? 'DNI QR' : rawCode;
        
        let rowContent;
        if (isOtros && item.DNI_DATA_1) {
            rowContent = `
                <td>${item.HORA}</td>
                <td>${item.NOMBRE_PROCESADO}</td>
                <td>${item.PERFIL}</td>
                <td>${item.DNI_DATA_1 || '-'}</td>
                <td>${item.DNI_DATA_2 || '-'}</td>
                <td>${item.DNI_DATA_3 || '-'}</td>
                <td>${item.DOMINIO || '-'}</td>
                <td>${item.OBSERVACIONES || '-'}</td>
            `;
        } else {
            rowContent = `
                <td>${item.HORA}</td>
                <td>${displayCode}</td>
                <td>${item.NOMBRE_PROCESADO}</td>
                <td>${item.PERFIL}</td>
                <td>${item.DOMINIO || '-'}</td>
                <td>${item.OBSERVACIONES || '-'}</td>
            `;
        }
        
        html += `<tr>${rowContent}</tr>`;
    });

    html += `
            </tbody>
        </table>
    `;
    return html;
}


function renderReporteListado() {
    document.getElementById('reporteSearch').value = ''; 
    filterReporteListado();
}

function filterReporteListado() {
    const searchTerm = document.getElementById('reporteSearch').value.toLowerCase();
    const data = getReporteData().reverse(); 

    const filteredData = data.filter(item => {
        if (!searchTerm) return true; 
        
        return Object.values(item).some(value => {
            if (value && typeof value === 'string') {
                return value.toLowerCase().includes(searchTerm);
            }
            return false;
        });
    });

    lastFilteredData = filteredData;

    const agentesData = filteredData.filter(item => item.IS_AGENT === 'true');
    const otrosData = filteredData.filter(item => item.IS_AGENT === 'false');
    
    document.getElementById('agentesTableContainer').innerHTML = generateReportTableHTML(agentesData, 'Agentes');
    document.getElementById('otrosTableContainer').innerHTML = generateReportTableHTML(otrosData, 'Otros');
}

// --- FUNCIONES DE EXPORTACIÓN (omito cuerpos para brevedad) ---

function prepareExportData(tableTitle) {
    const dataToExport = tableTitle === 'Agentes' 
        ? lastFilteredData.filter(item => item.IS_AGENT === 'true')
        : lastFilteredData.filter(item => item.IS_AGENT === 'false');

    let header = ["FECHA", "HORA", "PERFIL", "CÓDIGO/DNI", "NOMBRE_PROCESADO", "DOMINIO", "OBSERVACIONES"];
    
    if (tableTitle === 'Otros') {
        header = ["FECHA", "HORA", "PERFIL", "NOMBRE_PROCESADO", "DNI_DATO_1", "DNI_DATO_2", "DNI_DATO_3", "DOMINIO", "OBSERVACIONES"];
    }

    const body = dataToExport.map(item => {
        let row = [
            item.FECHA,
            item.HORA,
            item.PERFIL,
            item.NOMBRE_PROCESADO,
            item.DOMINIO || '',
            item.OBSERVACIONES || ''
        ];
        
        if (tableTitle === 'Otros' && item['CREDENCIAL / DNI'].includes('@')) {
            const dniParts = item['CREDENCIAL / DNI'].split('@');
            row = [
                item.FECHA,
                item.HORA,
                item.PERFIL,
                item.NOMBRE_PROCESADO,
                dniParts[0] || '', 
                dniParts[1] || '', 
                dniParts[2] || '', 
                item.DOMINIO || '',
                item.OBSERVACIONES || ''
            ];
        } else if (tableTitle === 'Agentes') {
            row.splice(3, 0, item['CREDENCIAL / DNI']); 
        } else {
             row.splice(3, 0, item['CREDENCIAL / DNI']); 
        }

        return row;
    });

    return { header, body };
}

function exportarAExcel(tableTitle) {
    const { header, body } = prepareExportData(tableTitle);
    const data = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableTitle);
    const filename = `${tableTitle}_Reporte_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, filename);
    showAlert(`Exportando ${tableTitle} a Excel...`, 'info');
}

function exportarAPDF(tableTitle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    const { header, body } = prepareExportData(tableTitle);
    const searchTerm = document.getElementById('reporteSearch').value.trim();

    doc.setFillColor(255, 255, 255); 
    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(14);
    doc.text(`REPORTE DE INGRESOS - ${tableTitle.toUpperCase()}`, 14, 15);
    
    doc.setFontSize(10);
    const filterText = searchTerm ? `Filtro aplicado: "${searchTerm}"` : `Fecha de Exportación: ${new Date().toLocaleString('es-AR')}`;
    doc.text(filterText, 14, 20);

    doc.autoTable({
        head: [header],
        body: body,
        startY: 25,
        styles: { fontSize: 8, cellPadding: 2, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, 
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }, 
        margin: { top: 10 }
    });

    const filename = `${tableTitle}_Reporte_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    showAlert(`Exportando ${tableTitle} a PDF...`, 'info');
}


// --- LÓGICA DE ENVÍO DE FORMULARIO (FEEDBACK VISUAL) ---

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
        showAlert("'PERFIL' es un campo obligatorio. Por favor, seleccione un perfil.", 'danger');
        return;
    }
    
    processCodeAndDisplayResult(barcodeValue); 

    const agentName = barcodeInput.getAttribute('data-processed-name') || 'N/A';
    const isAgentFlag = barcodeInput.getAttribute('data-is-agent') || 'false';

    let dniDataFields = {};
    if (barcodeValue.includes('@')) {
        const dniParts = barcodeValue.split('@');
        dniDataFields = {
            DNI_DATA_1: dniParts[0] || '',
            DNI_DATA_2: dniParts[1] || '',
            DNI_DATA_3: dniParts[2] || '',
        };
    }

    const formData = {
        FECHA: new Date().toLocaleDateString('es-AR'),
        HORA: new Date().toLocaleTimeString('es-AR', { hour12: false }),
        PERFIL: perfilValue,
        DOMINIO: document.getElementById('text1_id').value,
        OBSERVACIONES: document.getElementById('text2_id').value,
        'CREDENCIAL / DNI': barcodeValue,
        'NOMBRE_PROCESADO': agentName,
        'IS_AGENT': isAgentFlag, 
        'DESTINO': 'Unidad de Control Penitenciario',
        ...dniDataFields 
    };

    const storedData = getReporteData();
    storedData.push(formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    // 1. Reproducir sonido de confirmación
    playBeep();

    // 2. Feedback Visual: Botón verde por 2 segundos
    sendButtonRect.classList.add('success-flash');
    
    // 3. Feedback de texto debajo del formulario
    const feedbackContainer = document.getElementById('send-feedback-container');
    feedbackContainer.innerHTML = `<div class="alert alert-success mt-2 text-center" role="alert">
        ✅ Registro de <strong>${agentName}</strong> enviado con éxito.
    </div>`;

    setTimeout(() => {
        // 4. Quitar el color verde y el mensaje
        sendButtonRect.classList.remove('success-flash');
        feedbackContainer.innerHTML = '';
        
        // 5. Resetear la interfaz para el siguiente ingreso
        document.getElementById('control-form').reset();
        document.getElementById('barcode_id').value = '';
        document.getElementById('list_id').value = ''; 
        processCodeAndDisplayResult('');
    }, 2000);
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('control-form').addEventListener('submit', submitForm);

    document.getElementById('barcode_id').addEventListener('change', (e) => {
        processCodeAndDisplayResult(e.target.value.trim());
    });

    document.getElementById('reporteSearch').addEventListener('input', filterReporteListado);

    const modalElement = document.getElementById('scannerModal');
    modalElement.addEventListener('shown.bs.modal', () => {
        startScanner();
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
        stopScanner();
    });

    const reporteModalElement = document.getElementById('reporteModal');
    reporteModalElement.addEventListener('shown.bs.modal', () => {
        renderReporteListado();
    });

    console.log("Aplicación de Control General cargada. Modo oscuro activo.");
});
