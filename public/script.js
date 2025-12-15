const socket = io();
const startBtn = document.getElementById('startBtn');
const statusDiv = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');

let localStream;
let peerConnection;
let partnerId = null;

// Pulsuz STUN serverləri (Google)
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.innerText = "Axtarılır...";
    
    // Mikrofon icazəsi al
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        statusDiv.innerText = "Mikrofon aktivdir. Tərəfdaş axtarılır...";
        socket.emit('find_match');
    } catch (err) {
        statusDiv.innerText = "Xəta: Mikrofona icazə verin!";
        console.error(err);
        startBtn.disabled = false;
    }
});

// Serverdən gələn cavablar
socket.on('waiting', (msg) => {
    statusDiv.innerText = msg;
});

socket.on('match_found', async (data) => {
    statusDiv.innerText = "Tərəfdaş tapıldı! Bağlantı qurulur...";
    partnerId = data.partner;
    
    createPeerConnection();

    // Səs axınını əlavə et
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (data.role === 'initiator') {
        // İlk qoşulan tərəf "təklif" (offer) göndərir
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { target: partnerId, signal: offer });
    }
});

// WebRTC Siqnalları (Offer/Answer/ICE)
socket.on('signal', async (data) => {
    if (!peerConnection) return;

    if (data.signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { target: partnerId, signal: answer });
    } 
    else if (data.signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    } 
    else if (data.signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Qarşı tərəfdən səs gələndə
    peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        statusDiv.innerText = "Bağlantı quruldu! Danışa bilərsiniz.";
    };

    // Bağlantı namizədlərini göndər
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { target: partnerId, signal: { candidate: event.candidate } });
        }
    };
}