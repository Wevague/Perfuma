const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSChema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');




const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({});
        const brand = await Brand.find({ isBlocked: false });
        
        res.render('product-add', {
            cat: category,
            brand: brand,
        });
    } catch (error) {
        res.redirect('/pageerror');
    }
};


const addProducts = async (req, res) => {
    try {
        const product = req.body;
    

        const productExists = await Product.findOne({
            productName: product.productName,
        });


        if (!productExists) {
            const images = [];

            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;

                   
                    const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
                    const resizedImagePath = path.join('public', 'uploads', 're-image', resizedImageName);

                   
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(resizedImageName); 
                }
            }

            const categoryId = await Category.findOne({ name: product.category });
            if (!categoryId) {
                return res.status(400).json('Invalid category name');
            }

            const volumes = product['variant-volume']; 
            const prices = product['variant-price']; 
            const quantities = product['variant-stock']; 
            
            const stockVariants = volumes.map((volume, index) => {
                return {
                    volume: volume,
                    price: parseFloat(prices[index]) || 0, 
                    quantity: parseInt(quantities[index], 10) || 0, 
                };
            }).filter(variant => variant.volume && variant.quantity);
            

            const newProduct = new Product({
                productName: product.productName,
                description: product.description,
                category: categoryId._id,
                regularPrice: product.regularPrice,
                salePrice: product.salePrice,
                createdOn: new Date(),
                quantity: Number(product.quantity),
                volume: product.volume,
                relatedProducts: product.relatedProducts || [],
                size: product.size,
                productImage: images, 
                stock: stockVariants,
                status: 'Available',
            });

            await newProduct.save();
            
            return res.redirect('/admin/addProducts');
        } else {
            return res.status(400).json('Product already exists, please try with another name');
        }
    } catch (error) {
        console.error('Error saving product', error);
        return res.redirect('/admin/pageerror');
    }
};

    const getAllProducts = async (req,res)=>{
        try {
            const search = req.query.search || "";
            const page = req.query.page || 1;
            const limit= 4;

            const productData = await Product.aggregate([
                {
                    $match: {
                        $or: [
                            { productName: { $regex: new RegExp(".*" + search + ".*") } },
                            { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
                        ]
                    }
                },
                {
                    $addFields: {
                        totalStockQuantity: { $sum: "$stock.quantity" } 
                    }
                },
                { $skip: (page - 1) * limit },
                { $limit: limit }
            ]);
    
            // Count the total number of matching products
            const count = await Product.find({
                $or: [
                    { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                    { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
                ]
            }).countDocuments();

            
            const category= await Category.find({isListed:true});
            const brand = await Brand.find({isBlocked:false});

             if(category && brand){
                res.render('products',{
                    data:productData,
                    currentPage:page,
                    totalPages:Math.ceil(count/limit),
                    cat:category,
                    brand:brand,

                })
             }else{
                res.render('page-404');
             }


        } catch (error) {
            
            res.redirect('/pageerror');
        }
    };

    const blockProduct = async(req,res)=>{
        try {

            let id = req.query.id;
            await Product.updateOne({_id:id},{$set:{isBlocked:true}});
            res.redirect('/admin/products');

        } catch (error) {
            console.error("Error blocking product:", error);
            res.redirect('/pageerror')
        }
    }

    
    const unblockProduct = async (req,res)=>{
        try {
            
            let id = req.query.id;
            await Product.updateOne({_id:id},{$set:{isBlocked:false}});
            res.redirect('/admin/products');


        } catch (error) {

            res.redirect('/pageerror');
            
        }
    }


        const getEditProduct = async (req,res)=>{
            try {
                
                const id= req.query.id;
                const product = await Product.findOne({_id:id});
                const category = await Category.find({});
               
                
                const brand = await Brand.find({});
                res.render('edit-product',{
                    product:product,
                    category: category,
                    brand:brand,   
                    stock: product.stock,
                    selectedCategory: product.category

                })

            } catch (error) {
                console.log(error.message);
                
                res.redirect('/pageerror');
                
            }
        }


    const editProduct = async (req, res) => {
        try {
            const id = req.params.id;
            const data = req.body;
    
           
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).send('Product not found');
            }
    
           
            const existingProduct = await Product.findOne({
                productName: data.productName,
                _id: { $ne: id } 
            });
    
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    images.push(req.files[i].filename);
                }
            }
    
          
            const category = await Category.findOne({ name: data.category });
            console.log('wwww',category);
            
            
            const updateFields = {
                productName: data.productName,
                description: data.descriptionData,
                category: category._id,  
                categoryName: category.name,
                quantity: data.quantity, 
                size: data.size,
                volume: data.volume,
                price:data.price 
            };
    
            console.log("updateFields",updateFields);
            
            
            if (images.length > 0) {
                updateFields.$push = { productImage: { $each: images } };
            }
    
        
            if (data.volume && data.price && data.quantity) {
                const updatedStock = data.volume.map((vol, index) => ({
                    volume: vol,
                    price: data.price[index],     
                    quantity: data.quantity[index] 
                }));
                
                updateFields.stock = updatedStock;
            }
    
            await Product.findByIdAndUpdate(id, updateFields, { new: true });
    
            
            res.redirect('/admin/products');
        } catch (error) {
            console.error("Edit error:", error);
            res.redirect('/pageerror');
        }
    };
    
    const deleteSingleImage = async(req,res)=>{
        try {
            
            const {imageNameToServer,productIdToServer}= req.body
            const product  = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
             imagePath = path.join('public','uploads','re-image',imageNameToServer);
             if(fs.existsSync(imagePath)){
                await fs.unlinkSync(imagePath);
                console.log(`image ${imageNameToServer} deleted successfully`);
                
             }else{
                console.log(`image ${imageNameToServer} not found`);
                
             }
             res.send({status:true});

        } catch (error) {
            res.redirect('/pageerror')
        }
    }


    
    const ProductOffer = async(req,res)=>{
        try {

            const productsWithOffers = await Product.find({ productOffer: { $gt: 0 } });
            
            return res.render('productOffer',{productsWithOffers});
            
        } catch (error) {
            res.redirect('/pageerror')
        }
    }

    const loadaddnewOffer = async(req,res)=>{
        try {

            const products = await Product.find({ status: 'Available' }); 
            
            return res.render('addOffer',{ products });

            
        } catch (error) {
            res.redirect('/pageerror')
            
        }
    }

    const addOffer = async(req,res)=>{
        try {
            const { offerName, product, offerDiscount } = req.body;
            
    
            const updatedProduct = await Product.findByIdAndUpdate(
                product, 
                { 
                    $set: { productOfferName: offerName, 
                        productOffer: offerDiscount } 
                },
                { new: true }
            );
            
    
            if (updatedProduct) {
                res.redirect('/admin/productOffer');
            } else {
                res.status(404).send('Product not found');
            }
        } catch (error) {
            console.error('Error adding offer:', error);
            res.redirect('/pageerror'); 
        }
    }

    const deleteOffer = async(req,res)=>{
        try {
            const productId = req.query.id;  
    
            const updatedProduct = await Product.findByIdAndUpdate(
                productId, 
                { $unset: { productOffer: 1 } }, 
                { new: true }
            );
    
            if (updatedProduct) {
                console.log('Offer deleted successfully for product:', updatedProduct.productName);
                res.redirect('/admin/productOffer');
            } else {
                res.status(404).send('Product not found');
            }
        } catch (error) {
            console.error('Error deleting offer:', error);
            res.redirect('/pageerror');  
        }
    }


    const editOffer = async (req, res) => {
        try {
            const { id } = req.query;  
            
            const product = await Product.findById(id); 
    
            if (!product) {
                return res.status(404).send('Product not found');
            }
    
            return res.render('editOffer', { product });
        } catch (error) {
            res.redirect('/pageerror'); 
        }
    };

    const updateEditOffer = async(req,res)=>{
        try {
            const { offerName, offerDiscount, productId } = req.body;

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }

            product.productOfferName = offerName;
            product.productOffer = offerDiscount;

            await product.save();

           return res.redirect('/admin/productOffer');
                   
        } catch (error) {
            res.redirect('/pageerror'); 
            
        }
    }
    



    


module.exports ={

    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    ProductOffer,
    loadaddnewOffer,
    addOffer,
    deleteOffer,
    editOffer,
    updateEditOffer
    
}
