const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
    try {
        const hasRealUri = Boolean(process.env.MONGO_URI);
        let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulseboard';
        try {
            // A real (Atlas) URI needs longer than a local mongod to answer.
            await mongoose.connect(uri, { serverSelectionTimeoutMS: hasRealUri ? 20000 : 2000 });
            // Never log credentials.
            console.log('MongoDB connected to:', uri.replace(/\/\/[^@/]*@/, '//***@'));
            return;
        } catch (localErr) {
            console.log('Direct MongoDB connection failed:', localErr.message);
            // If a real URI was configured, surface that error instead of trying the in-memory fallback.
            if (hasRealUri) throw localErr;
            console.log('Attempting in-memory fallback...');
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
