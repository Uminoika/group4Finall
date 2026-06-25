const mongoose = require('mongoose');

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['owner', 'coworker'] }
});

// Property Model
const propertySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, required: true },
  neighborhood: { type: String, required: true },
  sqft: { type: Number, required: true },
  garage: { type: String, required: true },
  transport: { type: String, required: true }
});

// Workspace Model
const workspaceSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  type: { type: String, required: true },
  seats: { type: Number, required: true },
  smoking: { type: String, required: true },
  availability: { type: String, required: true },
  term: { type: String, required: true },
  price: { type: Number, required: true }
});

const User = mongoose.model('User', userSchema);
const Property = mongoose.model('Property', propertySchema);
const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = { User, Property, Workspace };