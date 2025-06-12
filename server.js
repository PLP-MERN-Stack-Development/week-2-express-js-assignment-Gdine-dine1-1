// server.js - Express server with MongoDB integration

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import Product model
const Product = require('./models/Product');

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Validation middleware
const validateProduct = (req, res, next) => {
  const { name, description, price, category } = req.body;
  if (!name || !description || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number' });
  }
  next();
};
// Products are stored in MongoDB

// Error Classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Product API! Go to /api/products to see all products.');
});

// GET /api/products - Get all products with filtering, search, and pagination
app.get('/api/products', async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: products
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get a specific product
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create a new product
app.post('/api/products', authenticateApiKey, validateProduct, async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update a product
app.put('/api/products/:id', authenticateApiKey, validateProduct, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', authenticateApiKey, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/stats/categories - Get product statistics
app.get('/api/stats/categories', async (req, res, next) => {
  try {
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const formattedStats = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});
    
    res.json(formattedStats);
  } catch (error) {
    next(error);
  }
});

// TODO: Implement custom middleware for:
// - Request logging
// - Authentication
// - Error handling

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the app for testing purposes
module.exports = app; 