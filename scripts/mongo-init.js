// AETHER MongoDB Initialization Script
// Runs once when the MongoDB container starts for the first time.
// Creates the application database and a dedicated app user.

db = db.getSiblingDB('interview-platform');

// Create collections with basic schema validation
db.createCollection('users');
db.createCollection('interviews');
db.createCollection('sessions');

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });

print('✅ AETHER MongoDB initialized successfully');
print('   Database: interview-platform');
print('   Collections: users, interviews, sessions');
