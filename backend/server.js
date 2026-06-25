const mongoose = require('mongoose');
const { User, Property, Workspace } = require('./models');

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
// const fs = require('fs');
// const path = require('path');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// ── JSON "database" helpers ──────────────────────────────────────────────────
// const DB_FILE = path.join(__dirname, 'db.json');

// function readDB() {
//   if (!fs.existsSync(DB_FILE)) {
//     const empty = { users: [], properties: [], workspaces: [] };
//     fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
//     return empty;
//   }
//   return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
// }

// function writeDB(data) {
//   fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
// }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// console.log('Using local JSON database (db.json)');

// ── JWT middleware ────────────────────────────────────────────────────────────
console.log("AUTH HEADER:", req.headers.authorization);
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  // const token = process.env.JWT_SECRET
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ── Test route ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.send('WorkSpace Finder Server is running!');
});

// ── REGISTER ──────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    // const db = readDB();
    // if (db.users.find(u => u.email === email)) {
    //   return res.status(400).json({ message: 'Email already registered' });
    // }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // const newUser = { _id: generateId(), name, phone, email, password: hashedPassword, role };
    // db.users.push(newUser);
    // writeDB(db);
    const newUser = await User.create({
      name,
      phone,
      email,
      password: hashedPassword,
      role
    });
    res.status(201).json({ message: 'User registered successfully', user: { id: newUser._id, name, email, role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // const db = readDB();
    // const user = db.users.find(u => u.email === email);
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
    // const db = readDB();
    // const newProperty = { _id: generateId(), ownerId: req.user.id, address, neighborhood, sqft, garage, transport };
    // db.properties.push(newProperty);
    // writeDB(db);
    const newProperty = Property.create({
      ownerId: req.user.id,
      address,
      neighborhood,
      sqft,
      garage,
      transport
    });

    res.status(201).json({ message: 'Property added successfully', property: newProperty });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET PROPERTIES by owner ───────────────────────────────────────────────────
app.get('/properties/:ownerId', authenticateToken, async (req, res) => {
  try {
    // const db = readDB();
    // const properties = db.properties.filter(p => p.ownerId === req.params.ownerId);
    const properties = Property.find({
      ownerId: req.params.ownerId
    });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//── EDIT PROPERTY ─────────────────────────────────────────────────────────────
app.put('/properties/:id', authenticateToken, async (req, res) => {
  try {
    const db = readDB();
    const idx = db.properties.findIndex(p => p._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Property not found' });
    db.properties[idx] = { ...db.properties[idx], ...req.body };
    writeDB(db);
    res.json({ message: 'Property updated successfully', property: db.properties[idx] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// //rip another await
// const property = Property.findByIdAndUpdate(
//   req.params.id,
//   req.body,
//   { new: true }
// );

// if (!property)
//   return res.status(404).json({
//     message: 'Property not found'
//   });

// res.json({
//   message: 'Property updated successfully',
//   property
// });

// ── DELETE PROPERTY ───────────────────────────────────────────────────────────
app.delete('/properties/:id', authenticateToken, async (req, res) => {
  try {
    const db = readDB();
    const idx = db.properties.findIndex(p => p._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Property not found' });
    db.properties.splice(idx, 1);
    writeDB(db);
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//we murdering all awaits ig
// const propertyVariable = Property.findByIdAndDelete(req.params.id);

// if (!propertyVariable)
//   return res.status(404).json({
//     message: 'Property not found'
//   });

// res.json({
//   message: 'Property deleted successfully'
// });

// ── ADD WORKSPACE ─────────────────────────────────────────────────────────────
app.post('/workspaces', authenticateToken, async (req, res) => {
  try {
    const { propertyId, type, seats, smoking, availability, term, price } = req.body;
    // const db = readDB();
    // const newWorkspace = { _id: generateId(), propertyId, type, seats, smoking, availability, term, price };
    // db.workspaces.push(newWorkspace);
    // writeDB(db);

    const newWorkspace = await Workspace.create({
      propertyId,
      type,
      seats,
      smoking,
      availability,
      term,
      price
    });

    res.status(201).json({ message: 'Workspace added successfully', workspace: newWorkspace });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET ALL WORKSPACES ────────────────────────────────────────────────────────
// app.get('/workspaces', async (req, res) => {
//   try {
//     const db = readDB();
// 	// console.log(req.query);
// 	const { neighborhood, term, price, seats, smoking } = req.query;
// 	let results = db.workspaces;

// 	if(neighborhood !== undefined) {
// 		db.properties.forEach(property => {
// 			results = results.filter(value => {
// 				if(value.propertyId !== property._id) return true;

// 				return property.neighborhood === neighborhood;
// 			});
// 		});
// 	}

// 	if(term !== undefined) results = results.filter(value => value.term === term);
// 	if(price !== undefined && Number.parseFloat(price) !== NaN) results = results.filter(value => value.price === Number.parseFloat(price));
// 	if(seats !== undefined && Number.parseInt(seats) !== NaN) results = results.filter(value => value.seats === Number.parseInt(seats));
// 	if(smoking !== undefined) results = results.filter(value => value.smoking === smoking);

//     res.json(results);
//   } catch (err) {
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// });

app.get('/workspaces', async (req, res) => {
  try {
    const workspaces = await Workspace.find();
    res.json(workspaces);
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});

app.get('/workspaces/:id', async (req, res) => {
  try {
  //   const db = readDB();
	
	// const result = db.workspaces.filter(workspace => workspace._id === req.params.id);
  const workspace =
  await Workspace.findById(req.params.id);

if (!workspace) return res.status(404).json({ message: "Workspace not found" });
	//if(result.length !== 1) return res.status(404).json({ message: "Workspace not found" });
	return res.status(200).json(result[0]);

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── EDIT WORKSPACE ────────────────────────────────────────────────────────────
app.put('/workspaces/:id', authenticateToken, async (req, res) => {
  try {
    const db = readDB();
    const idx = db.workspaces.findIndex(w => w._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Workspace not found' });
    db.workspaces[idx] = { ...db.workspaces[idx], ...req.body };
    writeDB(db);
    res.json({ message: 'Workspace updated successfully', workspace: db.workspaces[idx] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

    // const workspace =
    //    Workspace.findByIdAndUpdate(
    //     req.params.id,
    //     req.body,
    //     { new: true }
    //   );

    // if (!workspace)
    //   return res.status(404).json({
    //     message: 'Workspace not found'
    //   });

    // res.json({
    //   message: 'Workspace updated successfully',
    //   workspace
    // });

// ── DELETE WORKSPACE ──────────────────────────────────────────────────────────
app.delete('/workspaces/:id', authenticateToken, async (req, res) => {
  try {
    const db = readDB();
    const idx = db.workspaces.findIndex(w => w._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Workspace not found' });
    db.workspaces.splice(idx, 1);
    writeDB(db);
    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// const workspaceAgain =
//  Workspace.findByIdAndDelete(
//     req.params.id
//   );

// if (!workspaceAgain)
//   return res.status(404).json({
//     message: 'Workspace not found'
//   });

// res.json({
//   message: 'Workspace deleted successfully'
// });

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});