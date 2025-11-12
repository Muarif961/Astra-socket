import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ["online", "offline"], default: "offline", required:false },
  socketId: { type: String, default: null, required:false }, 
});

export const User = mongoose.model("User", UserSchema);
