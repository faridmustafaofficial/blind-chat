const socket = io();
const nextBtn = document.getElementById('nextBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('status-text');
const remoteAudio = document.getElementById('remoteAudio');
const micWrapper = document.querySelector('.mic-wrapper');

let localStream;
let peerConnection;
let partnerId = null;
let isSearching = false;

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// UI Vəziyyətlərini İdarə Edən Funksiya
function setUIState(state) {
    micWrapper.classList.remove('active'); // Animasiyanı dayandır
    stopBtn.disabled = false;
    nextBtn.disabled = false;

    switch(state) {
        case 'idle': // Boş vəziyyət
            statusText.innerText = "Söhbətə başla";
            nextBtn.innerText = "BAŞLA";
            stopBtn.disabled = true;
            break;
        case 'searching': // Axtarış
            statusText.innerText = "Axtarılır...";
            nextBtn.innerText = "NÖVBƏTİ";
            nextBtn.disabled = true;
            micWrapper.classList.add('active');
            break;
        case 'connected': // Bağlandı
            statusText.innerText = "Bağlandı!";
            nextBtn.innerText = "NÖVBƏTİ";
            micWrapper.classList.add('active');
            break;
    }
}

// Cari söhbəti və ya axtarışı dayandır
function stopCurrentSession() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (partnerId) {
        // Qarşı tərəfə çıxdığımızı bildiririk (serverdə bunu qarşılayacağıq)
        socket.emit('disconnect_partner', partnerId);
        partnerId = null;
    }
    socket.emit('leave_queue'); // Növbədən çıx
    isSearching = false;
}

// "NÖVBƏTİ" düyməsi
nextBtn.addEventListener('click', async () => {
    stopCurrentSession(); // Əvvəlki sessiyanı bitir
    
    isSearching = true;
    setUIState('searching');
    
    // Mikrofon icazəsi al
    if (!localStream) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            statusText.innerText = "Xəta: Mikrofona icazə verin!";
            setUIState('idle');
            isSearching = false;
            return;
        }
    }
    
    socket.emit('find_match');
});

// "DAYAN" düyməsi
stopBtn.addEventListener('click', () => {
    stopCurrentSession();
    setUIState('idle');
});

// Serverdən gələn mesajlar
socket.on('waiting', (msg) => {
    if (isSearching) statusText.innerText = msg;
});

// Partnyor tapıldı
socket.on('match_found', async (data) => {
    if (!isSearching) return;
    isSearching = false;
    partnerId = data.partner;
    setUIState('connected');
    
    createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (data.role === 'initiator') {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { target: partnerId, signal: offer });
    }
});

// Partnyor çıxanda
socket.on('partner_disconnected', () => {
    stopCurrentSession();
    statusText.innerText = "Partnyor ayrıldı.";
    setTimeout(() => {
        if(!isSearching && !partnerId) setUIState('idle');
    }, 2000);
});

// WebRTC funksiyaları (Dəyişməyib)
socket.on('signal', async (data) => {
    if (!peerConnection) return;
    if (data.signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { target: partnerId, signal: answer });
    } else if (data.signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate)).catch(e=>{});
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    peerConnection.ontrack = (event) => { remoteAudio.srcObject = event.streams[0]; };
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && partnerId) socket.emit('signal', { target: partnerId, signal: { candidate: event.candidate } });
    };
    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected') {
             stopCurrentSession();
             statusText.innerText = "Bağlantı kəsildi.";
             setTimeout(() => setUIState('idle'), 2000);
        }
    }
}

// Başlanğıc vəziyyəti
setUIState('idle');
