import mongoose from "mongoose";

const { configDotenv } = require("dotenv");

configDotenv();

const local_db = process.env.MONGO_DB_CONNECTION_STRING_local || '';
const prod_db = process.env.MONGO_DB_CONNECTION_STRING_prod || '';
const ENV = process.env.ENV || 'prod';


export const connectDB = () =>{
    mongoose.connect(ENV==="dev"?local_db:prod_db)
    .then(()=>console.log(`${ENV} db connected`))
    .catch((error)=>console.error(error));
}

