import { Server } from 'socket.io'
import { v4 } from 'uuid'

const server = new Server(process.env.PORT || 3005, {
    cors: {
        origin: "*",
        methods: ["*"]
    }
})

const clients = {}
const rooms = {}

const findRoomByAvailability = ({ skipId }) => {
    const arrayRooms = Object.values(rooms)
    if (arrayRooms.length === 0) return false

    const room = arrayRooms.find(room => !room.onChatting && room.id !== skipId) || false

    return room
}

const findRoomByClient = (client) => {
    const arrayRooms = Object.values(rooms)

    const room = arrayRooms.find(room => room.client?.socketId === client.socketId || room.candidate?.socketId === client.socketId)

    return room
}

const addNewRoom = (client) => {
    const id = v4()
    rooms[id] = ({
        id,
        client,
        candidate: null,
        onChatting: false
    })
}



server.on('connection', socket => {
    socket.on('peer-open', data => {
        // Se registra la conexión peer en un diccionario para facilitar el acceso
        clients[socket.id] = {
            socketId: socket.id,
            peerId: data.id,
            skipId: null
        }

        // Se emite un evento al cliente avisando que se ha registrado el id de la conexión peer
        socket.emit('peer-id-registered')
    })

    socket.on('message', data => {
        socket.to(data.callSocketId).emit('message', data)
    })

    socket.on('search', () => {
        const room = findRoomByAvailability({ skipId: clients[socket.id].skipId })

        if (!room) {
            addNewRoom(clients[socket.id])
            socket.emit('wait')
        } else {
            rooms[room.id].candidate = clients[socket.id]
            rooms[room.id].onChatting = true

            // Envía la sala al cliente candidato
            socket.emit('room-found', room)
            // Envía al cliente creador la id de la conexión socket
            socket.to(room.client.socketId).emit('call', { id: socket.id })
        }
    })

    socket.on('skip', () => {
        const room = findRoomByClient(clients[socket.id])

        if (!room) return

        clients[socket.id].skipId = room.id
        // Vamos a validar sí somos los creadores de la sala
        if (room.client.socketId === socket.id) {
            // Sí somos los creadores, vamos a validar sí estamos en una charla
            if (room.onChatting) {
                /* 
                    Sí estamos charlando y nos desconectamos vamos a sederle la propiedad de la sala
                    al candidato y la dejamos en el estado inicial para que otro pueda unirse.
                */
                rooms[room.id].client = rooms[room.id].candidate
                rooms[room.id].candidate = null
                rooms[room.id].onChatting = false
            } else {
                /*
                    En caso de que no estemos en una charla, vamos a eliminar la sala
                */
                delete rooms[room.id]
            }
        } else {
            /*
                Sinó somos los creadores y abandonamos la sala, entonces vamos a dejar la sala
                en el estado inical para que otro pueda unirse.
            */
            rooms[room.id].candidate = null
            rooms[room.id].onChatting = false
        }

        socket.emit('skip-ready')
    })

    socket.on('disconnect', () => {
        /* 
            Buscamos la sala en la que estemos.
            Indistintamente sí seamos clientes creadores o candidatos, nos va a devolver la sala en la que estamos.
        */
        const room = findRoomByClient(clients[socket.id])

        if (!room) return

        // Vamos a validar sí somos los creadores de la sala
        if (room.client.socketId === socket.id) {
            // Sí somos los creadores, vamos a validar sí estamos en una charla
            if (room.onChatting) {
                socket.to(room.candidate.socketId).emit('waiting-again')
                /* 
                    Sí estamos charlando y nos desconectamos vamos a sederle la propiedad de la sala
                    al candidato y la dejamos en el estado inicial para que otro pueda unirse.
                */
                rooms[room.id].client = rooms[room.id].candidate
                rooms[room.id].candidate = null
                rooms[room.id].onChatting = false
            } else {
                /*
                    En caso de que no estemos en una charla, vamos a eliminar la sala
                */
                delete rooms[room.id]
            }
        } else {
            /*
                Sinó somos los creadores y abandonamos la sala, entonces vamos a dejar la sala
                en el estado inical para que otro pueda unirse.
            */
            socket.to(room.client.socketId).emit('waiting-again')
            rooms[room.id].candidate = null
            rooms[room.id].onChatting = false
        }
    })
})