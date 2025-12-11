// --- CONFIGURACIÓN DE FIREBASE ---
// ¡DEBES REEMPLAZAR ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE REAL!
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI", 
  authDomain: "TU_AUTH_DOMAIN_AQUI.firebaseapp.com",
  projectId: "TU_PROJECT_ID_AQUI", // Ejemplo: registro-ingresos-12345
  storageBucket: "TU_STORAGE_BUCKET_AQUI.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID_AQUI",
  appId: "TU_APP_ID_AQUI"
};

const COLLECTION_NAME = "ingresos_registrados"; 

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referencias a elementos del DOM
const readerDiv = "reader";
const modeAgenteBtn = document.getElementById('mode-agente');
const modePersonaBtn = document.getElementById('mode-persona');

const registerAgenteBtn = document.getElementById('register-agente-btn');
const registerPersonaBtn = document.getElementById('register-persona-btn');

// --- Variables de Estado Global ---
let html5QrcodeScanner;
let currentMode = 'agente'; 
let lastScannedData = null; 

// --- Funciones de Comunicación con Firebase ---

async function sendRegistrationData(data, type) {
    if (!data) return alert("No hay datos escaneados para registrar.");

    const button = (type === 'agente') ? registerAgenteBtn : registerPersonaBtn;
    
    button.disabled = true;
    button.textContent = 'Registrando en Firebase...';
    
    const registrationRecord = {
        ...data, 
        type: type, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection(COLLECTION_NAME).add(registrationRecord);
        
        alert("✅ Registro exitoso en Firebase!");
        button.textContent = 'Registro OK!';
        lastScannedData = null;
        
    } catch (error) {
        console.error('Error al registrar en Firebase:', error);
        alert(`❌ Error al registrar en Firebase: ${error.message}. Verifica tu conexión y las reglas de seguridad.`);
        button.textContent = 'Error al Registrar';
        button.disabled = false;
    }
}


// --- Lógica de Escaneo ---

function handleDniQrScan(decodedText) {
    const dataArray = decodedText.split('@');
    const nombre = dataArray[0] || 'N/A';
    const apellido = dataArray[1] || 'N/A';
    const dni = dataArray[2] || 'N/A';

    document.getElementById('raw-data-persona').textContent = decodedText;
    document.getElementById('nombre-persona').textContent = nombre;
    document.getElementById('apellido-persona').textContent = apellido;
    document.getElementById('dni-persona').textContent = dni;

    lastScannedData = { nombre, apellido, dni, raw: decodedText };
    registerPersonaBtn.disabled = false;
    registerPersonaBtn.textContent = 'Registrar Persona';
    
    html5QrcodeScanner.pause();
}

function handleAgenteBarcodeScan(decodedText) {
    document.getElementById('data-agente').textContent = decodedText;

    lastScannedData = { codigo_agente: decodedText };
    registerAgenteBtn.disabled = false;
    registerAgenteBtn.textContent = 'Registrar Agente';
    
    html5QrcodeScanner.pause();
}

function onScanSuccess(decodedText) {
    if (currentMode === 'agente') {
        handleAgenteBarcodeScan(decodedText);
    } else if (currentMode === 'persona') {
        handleDniQrScan(decodedText);
    }
}

function startScanner(mode) {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().catch(err => console.error("Error al detener el escáner:", err));
    }

    html5QrcodeScanner = new Html5Qrcode(readerDiv);
    
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 150 }, 
        formatsToSupport: mode === 'agente' 
            ? [Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.CODE_128] 
            : [Html5QrcodeSupportedFormats.QR_CODE] 
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess,
        (errorMessage) => { 
            // Esto es normal mientras el escáner busca códigos
        }
    ).catch(err => {
        alert(`No se pudo iniciar la cámara. Asegúrese de tener permiso. Error: ${err}`);
    });
}

function changeMode(mode) {
    currentMode = mode;

    // Resetear estado y botones
    registerAgenteBtn.disabled = true;
    registerPersonaBtn.disabled = true;
    registerAgenteBtn.textContent = 'Registrar Agente';
    registerPersonaBtn.textContent = 'Registrar Persona';
    document.getElementById('data-agente').textContent = '---';
    document.getElementById('nombre-persona').textContent = '---';
    
    document.getElementById('results-agente').classList.toggle('hidden', mode !== 'agente');
    document.getElementById('results-persona').classList.toggle('hidden', mode !== 'persona');
    document.getElementById('mode-agente').classList.toggle('active', mode === 'agente');
    document.getElementById('mode-persona').classList.toggle('active', mode !== 'agente');


    startScanner(mode);
}


// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners para los botones de modo
    document.getElementById('mode-agente').addEventListener('click', () => changeMode('agente'));
    document.getElementById('mode-persona').addEventListener('click', () => changeMode('persona'));

    // Event Listeners para los botones de REGISTRO
    registerAgenteBtn.addEventListener('click', () => {
        sendRegistrationData(lastScannedData, 'agente').finally(() => {
            html5QrcodeScanner.resume(); 
        }); 
    });
    registerPersonaBtn.addEventListener('click', () => {
        sendRegistrationData(lastScannedData, 'publico').finally(() => {
            html5QrcodeScanner.resume(); 
        }); 
    });

    // Iniciar la aplicación
    startScanner(currentMode);
});