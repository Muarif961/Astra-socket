import { Call } from "../models/Call.js";
import { User } from "../models/User.js";

export const registerSocketHandlers = (io) => {

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);


        socket.on("join", async ({ userId, userName }) => {
            try {
                socket.userId = userId;
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
        const normalizeRoomId = (roomId) => roomId.trim().replace(/[:!]/g, "_");
        socket.on("start-call", async ({ roomId, callerId, participants }) => {
            console.log(callerId, 'hit');

            try {
                const key = normalizeRoomId(roomId);
                socket.join(roomId);
                console.log(`Caller ${callerId} joined room ${roomId}`);
                activeCalls[key] = new Set([callerId, ...participants]);
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
            const key = normalizeRoomId(roomId);
            socket.join(roomId);
            if (!activeCalls[key]) {
                console.warn(`No active call found for ${roomId}, creating new entry`);
                activeCalls[key] = new Set();
            }

            activeCalls[key].add(userId);
            console.log(`User ${userId} joined room ${roomId}`);

            socket.to(roomId).emit("user-joined-call", { userId });
        });

        const leaveCall = async (roomId, userId) => {
            const key = normalizeRoomId(roomId);
            if (activeCalls[key]) {
                activeCalls[key].delete(userId);

                if (activeCalls[key].size <= 1) {
                    await Call.updateOne(
                        { roomId, status: "started" },
                        { $set: { status: "ended", endTime: new Date() } }
                    );
                    io.to(roomId).emit("call-ended", { roomId });
                    delete activeCalls[key];
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




        socket.on("offer", async ({ toUserId, callerId, offer }) => {
       
            
            try {
                const callee = await User.findOne({ userId: toUserId, status: "online" });
                if (!callee || !callee.socketId) {
                    console.warn("Callee not online");
                    return;
                }
               

                io.to(callee.socketId).emit("offer", { from: callerId, offer });
            } catch (error) {
                console.error("Error forwarding offer:", error);
            }
        });

        socket.on("answer", async ({ toUserId, answer, calleeId }) => {
            
            try {
                const caller = await User.findOne({ userId: toUserId, status: "online" });
                if (!caller) return;
                io.to(caller.socketId).emit("answer", { from: calleeId, answer });
            } catch (err) {
                console.error("Error forwarding answer:", err);
            }
        });

        socket.on("ice-candidate", async ({ toUserId, candidate }) => {
            console.log('here');
            
            try {
                const recipient = await User.findOne({ userId: toUserId, status: "online" });
                if (!recipient || !recipient.socketId) return;
                io.to(recipient.socketId).emit("ice-candidate", { from: socket.userId, candidate });
            } catch (err) {
                console.error("Error forwarding ICE candidate:", err);
            }
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
            delete activeCalls[normalizeRoomId(roomId)];
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
