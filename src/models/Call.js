import mongoose from "mongoose";

const CallSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    callerId: { type: String, required: true },
    calleeIds: { type: [String], required: true },
    isGroup: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, default: "started" },
});

export const Call = mongoose.model("Call", CallSchema);
