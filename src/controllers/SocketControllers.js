import { Call } from "../models/Call.js";

export const registerSocketHandlers = (io) => {

  const rooms = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    /**
     * Join a room
     * @param {string} roomId
     * @param {string} userId - callerId or joining user
     */
    socket.on("join", (roomId, userId) => {
      socket.join(roomId);
      console.log(`User ${userId} (${socket.id}) joined room ${roomId}`);

      if (!rooms[roomId]) rooms[roomId] = [];

      
      rooms[roomId].push({ socketId: socket.id, userId });

     
      socket.to(roomId).emit("user-joined", { userId, socketId: socket.id });

      
      const existingUsers = rooms[roomId]
        .filter((u) => u.socketId !== socket.id)
        .map((u) => ({ userId: u.userId, socketId: u.socketId }));

      io.to(socket.id).emit("existing-users", existingUsers);
    });

   
    socket.on("offer", ({ roomId, offer, to }) => {
      io.to(to).emit("offer", { from: socket.id, offer });
    });

    
    socket.on("answer", ({ roomId, answer, to }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    
    socket.on("ice-candidate", ({ roomId, candidate, to }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

   
    socket.on("start-call", async ({ roomId, callerId, participants }) => {
      try {
        const newCall = new Call({
          roomId,
          callerId,
          calleeIds: participants,
          isGroup: participants.length > 1,
          status: "started",
        });

        await newCall.save();
        console.log(`Call record saved to DB, room: ${roomId}`);
      } catch (error) {
        console.error("Error saving call:", error);
      }

      
      io.to(roomId).emit("call-started", {
        roomId,
        callerId,
        participants,
      });
    });

   
    socket.on("end-call", async ({ roomId }) => {
      try {
        const endTime = new Date();
        await Call.updateOne(
          { roomId, status: "started" }, 
          { $set: { status: "ended",endTime } }
        );
        console.log(`Call ${roomId} marked as ended at ${endTime}`);
      } catch (error) {
        console.log("Error updating call:", error);
      }

      io.to(roomId).emit("call-ended", { roomId });
    });

  
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      for (const [roomId, users] of Object.entries(rooms)) {
        const index = users.findIndex((u) => u.socketId === socket.id);

        if (index !== -1) {
          const [leavingUser] = users.splice(index, 1);
          socket.to(roomId).emit("user-left", {
            socketId: socket.id,
            userId: leavingUser.userId,
          });

          if (users.length === 0) delete rooms[roomId];
          break;
        }
      }
    });
  });
};
