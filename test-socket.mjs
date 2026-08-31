import { io } from 'socket.io-client';

// paste a valid Supabase JWT here when testing
// do not commit a real token
const token = "YOUR_JWT_HERE";

const socket = io("http://localhost:8080", {
    auth: {
        token,
    },
});

socket.on("connect", () => {
    console.log("Connected!");
    console.log("Socket ID:", socket.id);

    // test sending a message to the chat room
    socket.emit("sendMessage", {
        content: "Hello from OTHER user!",
    });

    // test requesting the first page of chat history
    socket.emit("getHistory", {
        page: 1,
    });
});

// listen for a new message broadcast from the server
socket.on("newMessage", (message) => {
    console.log("New message:", message);
});

// listen for chat history sent back to this client
socket.on("chatHistory", (data) => {
    console.log("Chat history:", data);
});

// listen for message deletion broadcast
socket.on("messageDeleted", (data) => {
    console.log("Message deleted:", data);
});

socket.on("error", (error) => {
    console.log("Socket error:", error);
});

socket.on("connect_error", (error) => {
    console.log("Connection error:", error.message);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});