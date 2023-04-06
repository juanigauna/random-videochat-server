import { Server } from 'socket.io'

const server = new Server(process.env.PORT || 3005, {
    cors: {
        origin: "*",
        methods: ["*"]
    }
})


const clients = {}
const candidates = {}

const searchCandidates = () => {
    const arrayCandidates = Object.values(candidates)
    if (arrayCandidates.length === 0) return false

    const candidate = arrayCandidates.find(candidate => !candidate.onChatting) || false

    return candidate
}

const addAsNewCandidate = (id, peerId) => {
    candidates[id] = ({
        id,
        peerId,
        onChatting: false
    })
}

server.on('connection', socket => {
    socket.on('peer-open', data => {
        clients[socket.id] = data.id
        socket.emit('peer-id-registered')
    })

    socket.on('message', data => {
        socket.broadcast.to(data.callSocketId).emit('message', data)
    })

    socket.on('search', () => {
        const candidate = searchCandidates()
        if (!candidate) {
            addAsNewCandidate(socket.id, clients[socket.id])
            socket.join(clients[socket.id])
            socket.emit('wait')
        } else {
            candidates[candidate.id].onChatting = true
            socket.emit('candidate-found', candidate)
            socket.join(candidate.peerId)
            socket.to(candidate.id).emit('call', { id: socket.id })
        }
    })
})