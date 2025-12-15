const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null; // Növbədə gözləyən istifadəçi

io.on('connection', (socket) => {
    console.log('Bir istifadəçi qoşuldu:', socket.id);

    socket.on('find_match', () => {
        if (waitingUser) {
            // Əgər kimsə gözləyirsə, onları birləşdir
            const partnerId = waitingUser.id;
            
            // Hər iki tərəfə tərəfdaş tapıldığı barədə məlumat ver
            socket.emit('match_found', { role: 'initiator', partner: partnerId });
            waitingUser.emit('match_found', { role: 'receiver', partner: socket.id });
            
            waitingUser = null; // Növbəni təmizlə
        } else {
            // Heç kim yoxdursa, bu istifadəçini növbəyə qoy
            waitingUser = socket;
            socket.emit('waiting', 'Başqa bir istifadəçi axtarılır...');
        }
    });

    // WebRTC Siqnalizasiya (Offer, Answer, ICE Candidates)
    // Bu hissə səsin qurulması üçün məlumatları birindən digərinə ötürür
    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
        // Real layihədə burada partnyora "qarşı tərəf çıxdı" mesajı göndərilməlidir
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server ${PORT} portunda işləyir`);
});