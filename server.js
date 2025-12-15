const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;

io.on('connection', (socket) => {
    console.log('İstifadəçi qoşuldu:', socket.id);

    socket.on('find_match', () => {
        if (waitingUser) {
            const partnerId = waitingUser.id;
            socket.emit('match_found', { role: 'initiator', partner: partnerId });
            waitingUser.emit('match_found', { role: 'receiver', partner: socket.id });
            waitingUser = null;
        } else {
            waitingUser = socket;
            socket.emit('waiting', 'Axtarılır...');
        }
    });

    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', { sender: socket.id, signal: data.signal });
    });

    // --- YENİ HİSSƏLƏR ---

    // İstifadəçi "DAYAN" basanda və ya axtarışdan imtina edəndə növbədən çıxar
    socket.on('leave_queue', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });

    // İstifadəçi çıxanda partnyora xəbər ver
    socket.on('disconnect_partner', (partnerId) => {
        io.to(partnerId).emit('partner_disconnected');
    });

    // --- YENİ HİSSƏLƏRİN SONU ---

    socket.on('disconnect', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
        // Qeyd: Real layihədə əgər istifadəçi aktiv söhbətdə ikən brauzeri bağlayarsa, 
        // onun partnyorunu tapıb 'partner_disconnected' göndərmək lazımdır. 
        // Bu versiyada sadəlik üçün bunu 'script.js'-dəki 'disconnect_partner'-ə həvalə edirik.
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server ${PORT} portunda işləyir`);
});
