import { connectDB } from "./src/db/config/mongoDB.js";
import express from 'express';
import cors from 'cors';


connectDB();

const app = express();
app.use(express.json());


const allowedOrigins = [''];

app.use(cors({
    origin:allowedOrigins
}));

export {app}

