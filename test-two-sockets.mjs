import { io } from 'socket.io-client';

// paste a valid Supabase JWT here when testing
// do not commit a real token
const token = "YOUR_JWT_HERE";

const socket1 = io("http://localhost:8080", {
    auth: { token },
});

const socket2 = io("http://localhost:8080", {
    auth: { token },
});

socket1.on("connect", () => {
    console.log("Client 1 connected:", socket1.id);

    socket1.emit("sendMessage", {
        content: "Hello from client 1!",
    });

    // test typing indicator
    setTimeout(() => {
        socket1.emit("typing", {
            isTyping: true,
        });
    }, 1000); // wait for Client 2 to connect and join the room before Client 1 sends the typing event so the typing event can be received by Client 2 during testing
});

socket2.on("connect", () => {
    console.log("Client 2 connected:", socket2.id);
});

// client 1 receives typing / presence events
socket1.on("userTyping", (data) => {
    console.log("Client 1 received typing event:", data);
});

socket1.on("presenceUpdate", (data) => {
    console.log("Client 1 presence:", data);
});

// client 2 receives typing / presence events
socket2.on("userTyping", (data) => {
    console.log("Client 2 received typing event:", data);
});

socket2.on("presenceUpdate", (data) => {
    console.log("Client 2 presence:", data);
});

socket1.on("newMessage", (message) => {
    console.log("Client 1 received:", message);
});

socket2.on("newMessage", (message) => {
    console.log("Client 2 received:", message);
});

socket1.on("error", (error) => {
    console.log("Client 1 error:", error);
});

socket2.on("error", (error) => {
    console.log("Client 2 error:", error);
});