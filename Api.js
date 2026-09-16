require('dotenv').config();
const express = require('express');
const mongose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI, { 
})
.then(() => {
    console.log('Connected to MongoDB Atlas!')
})
.catch((error) => {
    console.error('Error connecting to MongoDB Atlas:', error);
});

app.use(express.json());

const ProductSchema =  new moogoose .Schema({
    name: {
        type: String,
        required: true
    },
    price:{
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
});

const Product = moongoose.model('Product', ProductSchema);

//edit Zone
// Create a new ptoduct
app.post('/product' , async (req , res) => {
    try {
       const newProduct = new Product(req.body);
       const saveProduct = await newProduct.save();
       res.status(201).json(saveProduct);
    } catch (error) {
        res.status(400).json({ message: 'Error creating product', error });
    }
})

// get products All 
app.get ('products', async (req , res) => {
    try {
        //find all products in the database
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
});
// get Single Product by ID
app.get('/product/ :id', async (req, res) => {
    try {
        //find product by ID database
        const product = await Product.findById(req.params.id);
        if (!product) { //error handling if product not found
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
});

  // Update a product by ID
app.put('/product/ :id', async (req, res) => {
  try{
    const UpdatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!UpdatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(UpdatedProduct);
  } catch (error) {
      res.status(500).json({ message: 'Error updating product', error });
  }
});

//Delete a product by ID
app.delete('/product/:id', async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting product', error });

    }

});
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);

});