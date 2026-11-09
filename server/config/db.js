const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
    try {
        let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulseboard';
        try {
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
            console.log('MongoDB connected to:', uri);
            return;
        } catch (localErr) {
            console.log('Direct MongoDB connection failed, attempting in-memory fallback...');
        }

        try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongodInstance = await MongoMemoryServer.create();
            uri = mongodInstance.getUri();
            await mongoose.connect(uri);
            console.log('MongoDB connected to in-memory instance:', uri);
        } catch (fallbackErr) {
            console.error('In-memory MongoDB fallback also failed:', fallbackErr.message);
            throw fallbackErr;
        }
    } catch (err) {
        console.error("MongoDB connection Failed:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
