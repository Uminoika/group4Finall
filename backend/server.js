const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose'); // 1. Added Mongoose
require('dotenv').config();

// 2. Import your Mongoose models
const { User, Property, Workspace } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// 3. Connect to MongoDB Atlas via Environment Variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workspaceFinder';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('MongoDB connection error:', err));

// ── JWT middleware ────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ── Test route ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.send('WorkSpace Finder Server is running on MongoDB!');
});

// ── REGISTER ──────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    
    // Check MongoDB for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create and save via Mongoose
    const newUser = new User({ name, phone, email, password: hashedPassword, role });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully', user: { id: newUser._id, name, email, role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user in MongoDB
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid email or password' });
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── ADD PROPERTY ──────────────────────────────────────────────────────────────
app.post('/properties', authenticateToken, async (req, res) => {
  try {
    const { address, neighborhood, sqft, garage, transport } = req.body;
    
    const newProperty = new Property({ ownerId: req.user.id, address, neighborhood, sqft, garage, transport });
    await newProperty.save();

    res.status(201).json({ message: 'Property added successfully', property: newProperty });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET PROPERTIES by owner ───────────────────────────────────────────────────
app.get('/properties/:ownerId', authenticateToken, async (req, res) => {
  try {
    const properties = await Property.find({ ownerId: req.params.ownerId });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── EDIT PROPERTY ─────────────────────────────────────────────────────────────
app.put('/properties/:id', authenticateToken, async (req, res) => {
  try {
    const updatedProperty = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProperty) return res.status(404).json({ message: 'Property not found' });
    res.json({ message: 'Property updated successfully', property: updatedProperty });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE PROPERTY ───────────────────────────────────────────────────────────
app.delete('/properties/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Property.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Property not found' });
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── ADD WORKSPACE ─────────────────────────────────────────────────────────────
app.post('/workspaces', authenticateToken, async (req, res) => {
  try {
    const { propertyId, type, seats, smoking, availability, term, price } = req.body;
    
    const newWorkspace = new Workspace({ propertyId, type, seats, smoking, availability, term, price });
    await newWorkspace.save();

    res.status(201).json({ message: 'Workspace added successfully', workspace: newWorkspace });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET ALL WORKSPACES (With Filters) ─────────────────────────────────────────
app.get('/workspaces', async (req, res) => {
  try {
    const { neighborhood, term, price, seats, smoking } = req.query;
    let query = {};

    // Filter by fields natively on Workspace
    if (term) query.term = term;
    if (price) query.price = Number.parseFloat(price);
    if (seats) query.seats = Number.parseInt(seats);
    if (smoking) query.smoking = smoking;

    let workspaces = await Workspace.find(query);

    // Cross-reference filter for properties neighborhood if requested
    if (neighborhood) {
      const validProperties = await Property.find({ neighborhood });
      const validPropertyIds = validProperties.map(p => p._id.toString());
      workspaces = workspaces.filter(w => validPropertyIds.includes(w.propertyId.toString()));
    }

    res.json(workspaces);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET SINGLE WORKSPACE ──────────────────────────────────────────────────────
app.get('/workspaces/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    return res.status(200).json(workspace);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── EDIT WORKSPACE ────────────────────────────────────────────────────────────
app.put('/workspaces/:id', authenticateToken, async (req, res) => {
  try {
    const updatedWorkspace = await Workspace.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedWorkspace) return res.status(404).json({ message: 'Workspace not found' });
    res.json({ message: 'Workspace updated successfully', workspace: updatedWorkspace });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE WORKSPACE ──────────────────────────────────────────────────────────
app.delete('/workspaces/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Workspace.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Workspace not found' });
    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});