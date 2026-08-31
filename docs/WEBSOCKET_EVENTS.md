# WebSocket Events
This document describes the WebSocket events used by the chat system.

## Connection
Clients connect to the WebSocket server using Socket.IO and provide their Supabase JWT in the connection auth.

```
const socket = io("http://localhost:8080", {
    auth: {
        token,
    },
});
```

The server then authenticates the user and automatically joins them to the organization's chat room.

## sendMessage
Direction: Client → Server

Used by the frontend to send a new message.

payload: { "content": "Hey team!" }

```
socket.emit("sendMessage", {
    content: "Hey team!",
});
```

The server then saves that message to the database and broadcasts it to every connected socket in the room.

### newMessage
Direction: Server → All clients in the room

Sent (broadcasted) when a message is successfully saved

payload =
{
  "id": "msg-uuid-1234",
  "roomId": "org-uuid-5678",
  "senderId": "user-uuid-abcd",
  "senderName": "John Doe",
  "senderAvatar": "https://example.com/avatar.jpg",
  "content": "Hey team!",
  "createdAt": "2026-06-17T10:30:00.000Z"
}

```
socket.on("newMessage", (message) => {
    console.log("New message:", message);
});
```

Note: the sender also receives this event.

## getHistory
Direction: Client → Server

Used to request a page of chat history.

payload: { "page": 1 }

```
socket.emit("getHistory", {
    page: 1,
});
```

Each page contains up to 20 messages (page 1 uses offset 0, page 2 uses offset 20, etc.)

### chatHistory
Direction: Server → Requesting client only

Sent in response to getHistory.

payload =
{ "messages": 
    [ 
        { 
            "id": "msg-uuid-1234", 
            "roomId": "org-uuid-5678", 
            "senderId": "user-uuid-abcd", 
            "senderName": "John Doe", 
            "senderAvatar": "https://example.com/avatar.jpg", 
            "content": "Hey team!", 
            "createdAt": "2026-06-17T10:30:00.000Z" 
        } 
    ], "hasMore": true 
}

hasMore is true when additional messages are available on the next page.

```
socket.on("chatHistory", (data) => {
    console.log("Chat history:", data);
});
```

## error
Direction: Server → Client

Sent when an error occurs.

Common errors include:
- Missing auth token
- Auth failure
- User org not found
- Empty or missing message content
- Failed to save message
- Failed to request chat history

## typing
Direction: Client → Server

Sent when a user starts or stops typing.  

payload: { "isTyping": true }  

```
socket.emit("typing", {
            isTyping: true,
        });
```


`isTyping` is true when the user is typing and false the user stops typing.  

### userTyping
Direction: Server → Other clients in the room

Sent when another user starts or stops typing. The client that sent the typing event does not receive this event.

payload =
{
  "userId": "user-uuid-abcd",
  "name": "John Doe",
  "isTyping": true
}

```
socket.on("userTyping", (data) => {
    console.log("User received typing event:", data);
});
```

## presenceUpdate
Direction: Server → All clients in the room

Sent when a user connects or disconnects from the chat room.

payload =
{
  "onlineUsers": [
    "user-id-1",
    "user-id-2"
  ]
}

```
socket.on("presenceUpdate", (data) => {
    console.log("User presence:", data);
});
```


`onlineUsers` contains the IDs of the users currently connected to the room.
