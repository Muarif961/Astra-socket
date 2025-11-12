// import { Call } from "../models/Call.js";

// export const registerSocketHandlers = (io) => {

//     const rooms = {};

//     io.on("connection", (socket) => {
//         console.log("User connected:", socket.id);

//         /**
//          * Join a room
//          * @param {string} roomId
//          * @param {string} userId - callerId or joining user
//          */
//         socket.on("join", (roomId, userId) => {
//             socket.join(roomId);
//             console.log(`User ${userId} (${socket.id}) joined room ${roomId}`);

//             if (!rooms[roomId]) rooms[roomId] = [];


//             rooms[roomId].push({ socketId: socket.id, userId });


//             socket.to(roomId).emit("user-joined", { userId, socketId: socket.id });


//             const existingUsers = rooms[roomId]
//                 .filter((u) => u.socketId !== socket.id)
//                 .map((u) => ({ userId: u.userId, socketId: u.socketId }));

//             io.to(socket.id).emit("existing-users", existingUsers);
//         });


//         socket.on("offer", ({ roomId, offer, to }) => {
//             io.to(to).emit("offer", { from: socket.id, offer });
//         });


//         socket.on("answer", ({ roomId, answer, to }) => {
//             io.to(to).emit("answer", { from: socket.id, answer });
//         });


//         socket.on("ice-candidate", ({ roomId, candidate, to }) => {
//             io.to(to).emit("ice-candidate", { from: socket.id, candidate });
//         });


//         socket.on("start-call", async ({ roomId, callerId, participants }) => {
//             try {
//                 const newCall = new Call({
//                     roomId,
//                     callerId,
//                     calleeIds: participants,
//                     isGroup: participants.length > 1,
//                     status: "started",
//                 });

//                 await newCall.save();
//                 console.log(`Call record saved to DB, room: ${roomId}`);
//             } catch (error) {
//                 console.error("Error saving call:", error);
//             }
//             participants.forEach(userId => {
//                 const user = Object.values(rooms).flat().find(u => u.userId === userId);
//                 if (user) {
//                     io.to(user.socketId).emit("incoming-call", {
//                         roomId,
//                         callerId,
//                         participants,
//                     });
//                 }
//             });


//             io.to(roomId).emit("call-started", {
//                 roomId,
//                 callerId,
//                 participants,
//             });
//         });


//         socket.on("end-call", async ({ roomId }) => {
//             try {
//                 const endTime = new Date();
//                 await Call.updateOne(
//                     { roomId, status: "started" },
//                     { $set: { status: "ended", endTime } }
//                 );
//                 console.log(`Call ${roomId} marked as ended at ${endTime}`);
//             } catch (error) {
//                 console.log("Error updating call:", error);
//             }

//             io.to(roomId).emit("call-ended", { roomId });
//         });


//         socket.on("disconnect", () => {
//             console.log("User disconnected:", socket.id);

//             for (const [roomId, users] of Object.entries(rooms)) {
//                 const index = users.findIndex((u) => u.socketId === socket.id);

//                 if (index !== -1) {
//                     const [leavingUser] = users.splice(index, 1);
//                     socket.to(roomId).emit("user-left", {
//                         socketId: socket.id,
//                         userId: leavingUser.userId,
//                     });

//                     if (users.length === 0) delete rooms[roomId];
//                     break;
//                 }
//             }
//         });
//     });
// };
import { Call } from "../models/Call.js";
import { User } from "../models/User.js";

export const registerSocketHandlers = (io) => {

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);


        socket.on("join", async ({ userId, userName }) => {
            try {

                await User.findOneAndUpdate(
                    { userId },
                    { userName, status: "online", socketId: socket.id },
                    { upsert: true, new: true }
                );
                console.log(`User ${userName} (${userId}) is online.`);
            } catch (error) {
                console.error("Error registering user:", error);
            }
        });

        const activeCalls = {};
        socket.on("start-call", async ({ roomId, callerId, participants }) => {
            console.log(callerId, 'hit');

            try {

                socket.join(roomId);
                console.log(`Caller ${callerId} joined room ${roomId}`);
                activeCalls[roomId] = new Set([callerId, ...participants]);
                const newCall = new Call({
                    roomId,
                    callerId,
                    calleeIds: participants,
                    isGroup: participants.length > 1,
                    status: "started",
                });
                await newCall.save();
                console.log(`Call created in DB with roomId: ${roomId}`);
                const onlineUsers = await User.find({ userId: { $in: participants }, status: "online" });

                onlineUsers.forEach((user) => {
                    if (user.socketId) {
                        io.to(user.socketId).emit("incoming-call", {
                            callerId,
                            participants,
                            roomId
                        });
                    }
                });
            } catch (error) {
                console.error("Error notifying participants:", error);
            }
        });

        socket.on("join-call", async ({ roomId, callerId, participants, userId }) => {
            console.log(roomId, 'romId');

            socket.join(roomId);
            activeCalls[roomId].add(userId);
            console.log(`User ${userId} joined room ${roomId}`);

            socket.to(roomId).emit("user-joined-call", { userId });
        });

        const leaveCall = async (roomId, userId) => {
            if (activeCalls[roomId]) {
                activeCalls[roomId].delete(userId);

                if (activeCalls[roomId].size <= 1) {
                    await Call.updateOne(
                        { roomId, status: "started" },
                        { $set: { status: "ended", endTime: new Date() } }
                    );
                    io.to(roomId).emit("call-ended", { roomId });
                    delete activeCalls[roomId];
                }
            }
        };

        socket.on("leave-call", ({ roomId, userId }) => leaveCall(roomId, userId));

        socket.on("reject-call", async ({ callerId, userId }) => {
            try {
                const caller = await User.findOne({ userId: callerId, status: "online" });
                if (caller && caller.socketId) {
                    io.to(caller.socketId).emit("call-rejected", { userId });
                }
            } catch (error) {
                console.error("Error handling reject-call:", error);
            }
        });




        socket.on("offer", ({ to, offer }) => {
            io.to(to).emit("offer", { from: socket.id, offer });
        });

        socket.on("answer", ({ to, answer }) => {
            io.to(to).emit("answer", { from: socket.id, answer });
        });

        socket.on("ice-candidate", ({ to, candidate }) => {
            io.to(to).emit("ice-candidate", { from: socket.id, candidate });
        });


        socket.on("end-call", async ({ roomId }) => {
            try {
                await Call.updateOne(
                    { roomId, status: "started" },
                    { $set: { status: "ended", endTime: new Date() } }
                );
                console.log(`Call ${roomId} ended`);
            } catch (error) {
                console.error("Error ending call:", error);
            }

            io.to(roomId).emit("call-ended", { roomId });
        });


        socket.on("disconnect", async () => {
            console.log("User disconnected:", socket.id);

            try {
                const user = await User.findOneAndUpdate(
                    { socketId: socket.id },
                    { status: "offline", socketId: null }
                );
                if (user) {
                    Object.keys(activeCalls).forEach(roomId => leaveCall(roomId, user.userId));
                }
            } catch (error) {
                console.error("Error updating user status on disconnect:", error);
            }
        });
    });
};
