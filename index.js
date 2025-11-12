import { configDotenv } from "dotenv";
import { createServer } from "http";
import { app } from "./app.js";
import {Server as SocketIOServer} from 'socket.io';
import { registerSocketHandlers } from "./src/controllers/SocketControllers.js";

configDotenv();

const port = process.env.BACKEND_PORT || '8080';

const httpServer = createServer(app);

const allowedOrigins = [''];

const io = new SocketIOServer(httpServer,{
    cors:{
        origin:allowedOrigins,
        methods:['GET','POST','PUT'],
        credentials:true
    }
});

registerSocketHandlers(io);

httpServer.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
    
})



