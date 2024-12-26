const User = require('../../models/userSChema');
const Address = require('../../models/addressSchema');
const Wishlist = require('../../models/wishlistSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema')
const coupons = require('../../models/couponSchema');
const Wallet = require('../../models/walletSchema');
const Return = require('../../models/orderReturnSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit'); 
const session = require('express-session');
const mongoose = require('mongoose');





const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.log('Home page not loading', error);
        res.status(500).send('Server error');
    }
};


const pageNotFound = async (req, res) => {
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}



const loadHomepage = async (req, res) => {
    try {
        const userId = req.session.user;
        let userData = null;

        if (userId) {
            userData = await User.findOne({ _id: userId, isBlocked: false });
        }

        const productData = await Product.find({}).populate({
            path: 'category', 
            match: { isListed: true },
        });

        const filteredProducts = productData.filter(product => product.category !== null);

        res.render('home', { products: filteredProducts });

    } catch (error) {
        console.log('Home page not found', error);
        res.status(500).send('Server error');
    }
};





const loadShopPage = async (req, res) => {
    try {
        const query = req.query.query || '';
        const categoryId = req.query.category || '';
        const sortBy = req.query.sort || 'relevance';

        let filter = {};
        if (categoryId) {
            filter.category = categoryId;
        }
        if (query) {
            filter.productName = { $regex: query, $options: "i" };
        }

        let sort = {};
        if (sortBy === 'price-low') {
            sort = { 'stock.price': 1 };
        } else if (sortBy === 'price-high') {
            sort = { 'stock.price': -1 };
        } else if (sortBy === 'rating') {
            sort = { 'rating': -1 };
        }

        const products = await Product.find(filter).populate('category').sort(sort);

        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found' });
        }


        

        const categories = await Category.find({ isListed: true, isDeleted: false });

        res.render("shop", {
            products,
            categories,
            query,
            selectedCategory: categoryId,
            sortBy
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();

}



const loadProductPage = async (req, res) => {
    try {
        const user = req.session.user;
        const { id: productId } = req.query;
        const selectedVolume = req.query.volume || null;

        const inWishlist = await Wishlist.findOne({ userId: user });

        const categories = await Category.find({ isListed: true });

        // console.log(categories);
        
        const activeCategoriesId = categories.map(category => category._id);

        // console.log("activeCategoriesId",activeCategoriesId);
        

        const productData = await Product.findOne({
            _id: productId,
            isBlocked: false,
        }).populate('category');
    
        const productCategory = await Category.findById(productData.category);
        const relatedProducts = await Product.find({
            category: productData.category,
            _id: { $ne: productId },
            isBlocked: false,
        }).limit(5);
        const ans=productData.stock.map((a,b)=>{
            a.volume==selectedVolume
        })

        const stockData = productData.stock.map(item => {
            const categoryOfferPercentage = productCategory ? productCategory.categoryOffer : 0;
            const originalPrice = item.price || 0;

            console.log(originalPrice);
            
        
            const categoryDiscountedPrice = originalPrice * (1 - categoryOfferPercentage / 100);

            const productOfferDiscount = productData.productOffer || 0;
            const productDiscountedPrice = categoryDiscountedPrice * (1 - productOfferDiscount / 100);
            
            
            const totalDiscountPercentage = ((originalPrice - productDiscountedPrice) / originalPrice * 100).toFixed(2);
           
        
            const savings = originalPrice - productDiscountedPrice;
            
        
            return {
                volume: item.volume,
                originalPrice,
                categoryDiscountedPrice,
                productDiscountedPrice,
                totalDiscountPercentage, 
                finalDiscountedPrice: productDiscountedPrice, 
                savings,
                quantity: item.quantity,
              
            };
        });

        

        const totalQty = productData.stock.reduce((acc, { quantity }) => {
            acc += quantity;
            return acc;
        }, 0);

        const activeCoupons = await coupons.find({});
        
        let couponCode = null;
        if (activeCoupons.length > 0) {
            couponCode = activeCoupons[0].code;
        }


        
        return res.render("productDetails", {
            productData,
            relatedProducts,
            stockData,
            totalQty,
            inWishlist,
            selectedVolume,
            productOffer: productData.productOffer,
            couponCode
            
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};






async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP:${otp}</b>`,
        })
        return info.accepted.length > 0



    } catch (error) {
        console.error('Error sending email', error);
        return false

    }
}



const signup = async (req, res) => {
    const { name, email, phone, password, cpassword } = req.body;


    try {

        if (password !== cpassword) {
          
            return res.render('signup', { message: "Password do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('signup', { message: "User with email already exists" });
        }

        const otp = generateOtp();
        console.log(otp)
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render('signup', { message: "Error sending email" })
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };
        return res.render('verify-otp');

    } catch (error) {
        console.error('Signup error', error);
        res.redirect('/pageNotFound');
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)

        return passwordHash;
    } catch (error) {

    }
}



const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);

        if (otp === req.session.userOtp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            })
            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl: "/" })
        } else {
            res.status(400).json({ success: false, message: "Inavalid OTP please try again" })
        }

    } catch (error) {
        console.error('Error Verifying OTP', error);
        res.status(500).json({ success: false, messgae: "an  error occured" })

    }
}

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session." });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resent OTP:", otp);
            res.status(200).json({ success: true, message: "OTP resent successfully." });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


const loadLogin = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.render('login');
        } else {
            res.redirect('/home');
        }

    } catch (error) {
        res.redirect('/pageNotFound');

    }
}



const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const finduser = await User.findOne({ isAdmin: 0, email: email });
        if (!finduser) {
            return res.render('login', { message: "User not found" })
        }
        if (finduser.isBlocked) {
            return res.render('login', { message: "User is blocked by admin" })
        }
        const passwordMatch = await bcrypt.compare(password, finduser.password);
        if (!passwordMatch) {
            return res.render('login', { message: "Incorrect Password" });
        }
        req.session.user = finduser._id.toString();

        res.redirect('/home');
    } catch (error) {
        console.error('login error', error);
        res.render('login', { message: "Login Failed please try again later" })

    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Session error', err.message);
                return res.redirect('/pageNotFound');
            }
            return res.redirect('/login');
        })
    } catch (error) {
        console.log('logout error', error);
        res.redirect('/pageNotFound')

    }
}



const loadProfilePage = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect('/login');
        }


        const userData = await User.findOne({ _id: userId, isBlocked: false }).populate('address');

        if (!userData) {
            return res.redirect('/login');
        }
        const addresses = userData.address;



        return res.render('profile', { user: userData, addresses });

    } catch (error) {
        console.error("Error loading profile page:", error);
        res.redirect('/pageNotFound');
    }
};




const myaddressPage = async (req, res) => {
    try {


        const userId = req.session.user;
   
        const user = await User.findById(userId).populate('address');

        console.log(user);

        const addresses = user ? user.address : [];


        return res.render('myAddress', { addresses })


    } catch (error) {
        console.log(error);

    }
}



const OrderlistPage = async (req, res) => {
    try {
        const userId = req.session.user;

        const orders = await Order.find({ user: userId })
         .sort({ createdAt: -1 })
            .populate('address')
            .populate('orderedItems.product')
            .populate('orderedItems.orderStatus')
        console.log("orders", orders);


        const user = await User.findById(userId);
        const addresses = user.address;


        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                item.totalPrice = item.product.price * item.quantity;
            });
        });


        const returnProduct = await Return.find();

        
        return res.render('productList', { orders, addresses ,returnProduct});

    } catch (error) {
        console.log(error);
        res.status(500).send('Error loading orders');
    }
};




const removeItemFromOrder = async (req, res) => {
    const { orderId, itemId } = req.params;

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const itemIndex = order.orderedItems.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).send('Item not found');
        }

        const canceledItem = order.orderedItems[itemIndex];

        let canceledItemPrice = canceledItem.price * canceledItem.quantity;

        let discountAppliedToItem = 0;

        if (canceledItem.coupon) {
            discountAppliedToItem = canceledItem.couponDiscount || 0;
        } else if (order.discount && order.orderedItems.length > 0) {
            discountAppliedToItem = (order.discount / order.orderedItems.length);
        } else {
            discountAppliedToItem = order.discountPrice || 0;
        }

        canceledItemPrice -= discountAppliedToItem;

        canceledItem.orderStatus = 'Canceled'; 

        if(order.paymentMethod !== 'COD'){

            let userWallet = await Wallet.findOne({ user: order.user });
            
            if (!userWallet) {
                userWallet = new Wallet({
                    user: order.user,
                    balance: 0, 
                    transactions: [],
                });

                await userWallet.save();
            }

            userWallet.balance += canceledItemPrice;

            userWallet.transactions.push({
                orderId: order._id,
                amount: canceledItemPrice,
                status: 'success',
                type: 'credit',
            });

            await userWallet.save();
        }

        await order.save();

        res.redirect('/orderlist'); 

    } catch (error) {
        console.error("Error while removing item from order:", error);
        res.status(500).send('Internal server error');
    }
};



const   getInvoice = async(req,res)=>{
    try {
        const { orderId, itemId } = req.params;

        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                model: 'Product', 
                select: 'productName' 
            })
            .populate('user');

        if (!order) {
            console.error('Order not found for ID:', orderId);
            return res.status(404).send('Order not found');
        }

        console.log('Order found:', JSON.stringify(order, null, 2));

        const item = order.orderedItems.find(item => item._id.toString() === itemId);

        if (!item) {
            console.error('Item not found in order. Order Items:', order.orderedItems);
            return res.status(404).send('Item not found in order');
        }

        console.log('Item details:', JSON.stringify(item, null, 2));

        if (!item.product) {
            const product = await Product.findById(item.product);
            
            if (!product) {
                console.error('Product not found for ID:', item.product);
                return res.status(404).send('Product information missing');
            }

            item.product = product;
        }

        const pdfDoc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order.orderId}.pdf`);

        pdfDoc.pipe(res);

        pdfDoc.fontSize(25).text('Invoice', { align: 'center' });
        pdfDoc.fontSize(10);
        
        pdfDoc.text(`Order ID: ${order.orderId}`, 50, 100);
        pdfDoc.text(`Date: ${order.createdOn.toLocaleDateString()}`, 50, 120);
        
        pdfDoc.text('Customer Details:', 50, 160);
        pdfDoc.text(`Name: ${order.user.name}`, 50, 180);
        pdfDoc.text(`Email: ${order.user.email}`, 50, 200);
        
        pdfDoc.text('Item Details:', 50, 240);
        pdfDoc.text(`Product: ${item.product.productName || 'Unknown Product'}`, 50, 260);
        pdfDoc.text(`Quantity: ${item.quantity}`, 50, 280);
        pdfDoc.text(`Volume: ${item.volume}`, 50, 300);
        pdfDoc.text(`Price: ₹${item.price}`, 50, 320);
        const itemTotalPrice = item.price * item.quantity;
        pdfDoc.fontSize(15).text(`Total Price for Item: ₹${itemTotalPrice}`, 50, 340);

        if (order.orderedItems.length === 1) {
            pdfDoc.text(`Discount: ₹${order.discount}`, 50, 420);
        } else {
            pdfDoc.text(`Discount: ₹${order.discount}`, 50, 420);
        }
        pdfDoc.fontSize(10).text(`Payment Method: ${order.paymentMethod}`, 50, 440);

        pdfDoc.text(`Order Status: ${item.orderStatus}`, 50, 460);

        pdfDoc.end();

    } catch (error) {
        console.error('Complete Invoice Download Error:', error);
        res.status(500).send('Error generating invoice');
    }
}




const addAddressPage = async (req, res) => {
    const { redirect } = req.query;
    try {


        return res.render('addNewaddress', { redirect });

    } catch (error) {
        console.log(error);

    }
}

const saveAddress = async (req, res) => {

    const { redirect } = req.query;
    try {

        const userId = req.session.user;

        const { addressType, name, city, addressLine1, state, pincode, phone } = req.body;


        if (!userId) {
            return res.redirect('login');
        }


        const newAddress = new Address({
            addressType,
            name,
            city,
            state,
            pincode,
            phone,
            addressLine1,
        });


        const savedAddress = await newAddress.save();

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { address: savedAddress._id } },
            { new: true, upsert: true }
        );

        if (redirect) {
            return res.redirect(redirect)
        }

        return res.redirect('/myAddress');
    } catch (error) {

        console.error('Error saving address:', error);
        res.status(500).send('Error saving address');
    }
};


const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.addressId;


        await User.updateOne(
            { _id: userId },
            { $pull: { address: { _id: addressId } } }
        );

        return res.redirect('/myAddress');
    } catch (error) {
        console.error('Error deleting address:', error);
        res.redirect('/pageNotFound');
    }
};



const editProfile = async (req, res) => {
    try {

        const userId = req.session.user
        const user = await User.findOne({ _id: userId });

        const { name, phone, old_password, new_password, confirm_password } = req.body;

        const passwordMatch = await bcrypt.compare(old_password, user.password);
        if (passwordMatch) {
            if (new_password == confirm_password) {
                const passwordHash = await bcrypt.hash(new_password, 10)

                user.password = passwordHash
                await user.save()
            }
        }

        return res.redirect('/userProfile');

    } catch (error) {

        console.error("error update profile", error);
        res.redirect('pageNotFound');

    }
}

const editProfilePage = async (req, res) => {
    try {

        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.redirect('/profile');
        }

        res.render('profileEdit', { user });
    } catch (error) {
        console.log(error);

    }
}


const editAddressPage = async (req, res) => {
    const { redirect } = req.query;

    try {
        const userId = req.session.user;
        const { id } = req.query


        const user = await User.findById(userId);
        if (user) {
            const address = await Address.findById(id);

            if (address) {
                return res.render('editAddress', { address: address, redirect });
            }
        }


        res.redirect('/myAddress');

    } catch (error) {
        console.error("Error loading edit address page:", error);
        res.redirect('/pageNotFound');
    }
}

const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId, volume, quantity } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const product = await Product.findById(productId);
        const selectedStock = product.stock.find(stock => stock.volume === volume);

        if (!selectedStock || quantity > selectedStock.quantity) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        const cartItem = cart.items.find(
            item => item.productId.toString() === productId && item.stock.volume === volume
        );

        if (cartItem) {
            cartItem.quantity = quantity;
            cartItem.totalPrice = quantity * cartItem.price;
        }

        await cart.save();

        return res.status(200).json({ success: true, cart });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};



const updateAddress = async (req, res) => {

    try {
        const userId = req.session.user;
        const { id, redirect } = req.query;
        const { addressType, name, city, addressLine1, state, pincode, phone, altPhone } = req.body;

        const user = await User.findById(userId).populate('address');
        if (user) {

            const address = await Address.findById(id);
            if (address) {

                address.addressType = addressType;
                address.name = name;
                address.city = city;
                address.addressLine1 = addressLine1;
                address.state = state;
                address.pincode = pincode;
                address.phone = phone;
                address.altPhone = altPhone;


                await address.save();


                const index = user.address.indexOf(address._id);
                if (index !== -1) {

                    user.address[index] = address._id;
                    await user.save();
                }



            }
        }
        if (redirect) {
            return res.redirect(redirect)
        }

        return res.redirect('/myAddress');
    } catch (error) {
        console.error("Error updating address:", error);
        res.redirect('/pageNotFound');
    }
};




const loadCartPage = async (req, res) => {
    try {


    
       
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');


        if (!cart) {
            return res.render('cart', { cart: { items: [] }, cartCount: 0  });
        }

        cart.items.forEach(item => {

            const price = item.stock.price;
            const volume = item.stock.volume;
            const quantity = item.quantity;
            item.totalPrice = price * quantity;
        });

        const cartTotal = cart.items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
        const cartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);
        req.session.totalAmount = cartTotal;


        res.render('cart', { cart, cartTotal ,cartCount});
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    }
};



const addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const { quantity, productId, selectedVolume, price } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const selectedStock = product.stock.find(stock => stock.volume === selectedVolume);

        if (!selectedStock || selectedStock.quantity <= 0) {
            return res.status(400).json({ success: false, message: "Selected stock is not available." });
        }


        if (quantity <= 0) {
            return res.status(400).json({ success: false, message: "Quantity must be greater than zero." });

        }


        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });

        }

        const existingItem = cart.items.find(item => item.productId.toString() === productId && item.stock.volume === selectedVolume);

        if (existingItem) {


            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > selectedStock.quantity) {
                return res.status(400).json({ success: false, message: `Only ${selectedStock.quantity} items available in stock.` });
            }

            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * existingItem.price;
        } else {
            if (quantity > selectedStock.quantity) {
                return res.status(400).json({ success: false, message: "Not enough stock available." });
            }
       
            let val = product.stock.filter(({ volume, quantity, price }) => {
                if (selectedVolume == volume) {
                    return price
                }
            })
            const totalPrice = val[0].price
            cart.items.push({
                productId,
                totalPrice,
                productName: product.productName,
                stock: {
                    volume: selectedStock.volume,
                    quantity: selectedStock.quantity,
                    price: price
                }
            });

        }
        await cart.save();
        const cartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);
        req.session.cartCount = cartCount;

        return res.status(200).json({ success: true, message: "Product added to cart", cart,cartCount });


    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


const updateCart = async (req, res) => {

    const userId = req.session.user;
    const { productId, quantity } = req.body
    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            return res.status(404).send('Cart not found');
        }

        const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).send('Product not found in cart');
        }

        const product = cart.items[itemIndex];

        const price = product.stock.price;

        const totalPrice = price * quantity;

        product.quantity = quantity;
        product.totalPrice = totalPrice;

        await cart.save();

        return res.json({ success: true, cart: cart });
    } catch (error) {
        console.log(error);
        return res.status(500).send('Server error');
    }
}



const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.productId;
        const volume = req.params.volume;


        const cart = await Cart.findOneAndUpdate(
            {
                userId: userId,
                'items.productId': productId,
                'items.stock.volume': volume
            },
            {
                $pull: {
                    items: {
                        productId: productId,
                        'stock.volume': volume
                    }
                }
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).send('Cart not found or item not found in cart');
        }

        return res.redirect('/cart');
    } catch (error) {
        console.error('Error removing item:', error);
        return res.status(500).send('An error occurred while removing the item from the cart.');
    }
};



const loadcheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId).populate('address');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
        if (!cart || !cart.items.length) {
            return res.render("cart", { cart: null, totalAmount: 0 });
        }

        let totalAmount = cart.items.reduce((acc, item) => {
            const price = item.stock.price;
            const itemTotal = price * item.quantity;
            return acc + itemTotal;
        }, 0);

        if (req.session.totalAmount) {
            totalAmount = req.session.totalAmount;
        }

        const addresses = user.address;
        const couponsList = await coupons.find({ usedBy: { $nin: [userId] } });


        let totalProductOffer = 0;
        cart.items.forEach(item => {
            const productOfferPercentage = item.productId.productOffer || 0; 
            const productPrice = item.productId.stock[0].price; 
            
            const discountAmountPerProduct = (productOfferPercentage / 100) * productPrice; 

            const totalProductOfferForItem = discountAmountPerProduct * item.quantity;

            totalProductOffer += totalProductOfferForItem;
        });

        return res.render('checkout', {
            addresses,
            cart,
            totalAmount,
            couponsList,
            totalProductOffer,
          
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading checkout');
    }
};



const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;        
        const userId = req.session.user;

        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }

        const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: "Your cart is empty" });
        }

        let totalAmount = cart.items.reduce((acc, item) => {
            const price = item.stock.price;
            const itemTotal = price * item.quantity;
            return acc + itemTotal;
        }, 0);
     

        const coupon = await coupons.findOne({ code: couponCode });
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid coupon code" });
        }

        if (coupon.usedBy.includes(userId)) {
            return res.status(400).json({ success: false, message: "You have already used this coupon" });
        }
      
        if (totalAmount < coupon.minAmount) {
            return res.status(400).json({
                success: false,
                message: `Coupon requires a minimum total of ${coupon.minAmount}`
            });
        }

        const discountAmount = (totalAmount * coupon.discountPercentage) / 100;
        const discountToApply = Math.min(discountAmount, coupon.maxDiscount);

        const finalAmount = totalAmount - discountToApply;
        req.session.totalAmount = finalAmount;


        return res.json({ success: true, totalAmount: finalAmount, discountAmount :discountToApply});

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error applying coupon" });
    }
};



const removeCoupon = async(req,res)=>{
    try {
        const userId = req.session.user;
        
        const cart = await Cart.findOne({ userId: userId });
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).send("Cart is empty");
        }

        const originalTotalAmount = cart.items.reduce((acc, item) => acc + (item.stock.price * item.quantity), 0);

        req.session.discountAmount = 0;
        req.session.totalAmount = originalTotalAmount;

        return res.json({
            success: true,
            updatedTotalPrice: originalTotalAmount,
        });

    } catch (error) {
        console.error("Error removing coupon:", error);
        return res.status(500).send("Internal Server Error");
    }
}




const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { payment, selectedAddress,  couponCode } = req.body;

        
        if (!payment || payment === '') {
            return res.status(400).json({ success: false, message: "Payment method is required" });
        }

               
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send("User not found");
        }

        const selectedAddressDetails = user.address.find(addr => addr._id.toString() === selectedAddress);
        if (!selectedAddressDetails) {
            return res.status(400).send("Invalid address selected");
        }

        const cart = await Cart.findOne({ userId: userId });
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).send("Cart is empty");
        }

        const originalTotalPrice = Math.floor(req.session.totalAmount);
        let finalTotalPrice = originalTotalPrice;
        let discountAmount = 0; 



        if (payment === 'COD' && originalTotalPrice > 1000) {
            return res.status(400).json({ success: false, message: "Cash on Delivery (COD) is not available for orders above Rs 1000" });
        }

        if (couponCode) {
            const coupon = await coupons.findOne({ code: couponCode, isActive: true });
            if (!coupon) {
                return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
            }

            if (coupon.expirationDate && new Date() > coupon.expirationDate) {
                return res.status(400).json({ success: false, message: "Coupon has expired" });
            }

            if (originalTotalPrice < coupon.minAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Coupon requires a minimum purchase of ₹${coupon.minAmount}`
                });
            }

            if (coupon.usageLimit > 0 && coupon.usedBy.length >= coupon.usageLimit) {
                return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
            }

            discountAmount = (originalTotalPrice * coupon.discountPercentage) / 100;
            const discountAmountClamped = Math.min(discountAmount, coupon.maxDiscount);
            discountAmount = discountAmountClamped; 

            coupon.usedBy.push(userId);
            await coupon.save();

        }

        const orderedItems = cart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.stock.price,
            productImage: item.productImage,
            totalPrice: item.totalPrice,
            volume: item?.stock?.volume,
            orderStatus: "Pending"  
        }));

        const transactionId = `TRANS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        if (payment === 'wallet') {
            const walletuser = await Wallet.findOne({ user: userId });
            if (!walletuser) {
                return res.status(404).json({ success: false, message: "Wallet not found" });
            }

            const walletBalance = walletuser.balance;

            if (walletBalance < finalTotalPrice) {
                return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
            }

            walletuser.balance -= finalTotalPrice;
            await walletuser.save();
        }

        for (let item of cart.items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            if (product.isBlocked) {
                return res.status(400).json({
                    success: false,
                    message: `The product "${product.productName}" is no longer available for purchase.`
                });
            }

            const stockVariant = product.stock.find(stock => stock.volume === item.stock.volume);
            if (stockVariant) {
                if (stockVariant.quantity < item.quantity) {
                    return res.status(400).json({ success: false, message: `Insufficient stock for ${product.productName} (${stockVariant.volume})` });
                }

                stockVariant.quantity -= item.quantity;
            } else {
                return res.status(400).json({ success: false, message: `Stock variant not found for ${product.productName}` });
            }

            await product.save();
        }
        
        finalTotalPrice = parseFloat(finalTotalPrice.toFixed(2)); 


        console.log("finalTotalPrice",finalTotalPrice);
        

        const order = new Order({
            user: userId,
            orderedItems: orderedItems,
            totalPrice: finalTotalPrice, 
            address: selectedAddressDetails._id,
            paymentMethod: payment,
            status: "Pending",
            createdOn: new Date(),
            transactionId: transactionId,
            discount: discountAmount
        });

        await order.save();

        await Cart.updateOne({ userId: userId }, { $set: { items: [] } });

        req.session.cartItems = [];
        req.session.totalPrice = 0;

        return res.redirect("/orderconfirm");

    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).send("Internal Server Error");
    }
};






const loadOrderConfirm = async (req, res) => {
    try {

        const orderId = req.params.orderId;


        const order = await Order.findOne({ _id: orderId });

        return res.render('orderconfirm', { order });

    } catch (error) {
        console.log(error);
    }
}


const addTowishlist = async (req, res) => {
    try {
        const userId = req.session.user;
    
        const { productId } = req.body
      
        if (!userId) {
            return res.redirect('/login');
        }
        let wishlist = await Wishlist.findOne({ userId: userId }).populate('products.productId');

        if (!wishlist) {

            wishlist = new Wishlist({
                userId: userId,
                products: [],
            });


            await wishlist.save();

        }
        if (productId) {
            const isProductInWishlist = wishlist.products.find(product => product.productId.toString() === productId);
            if (!isProductInWishlist) {
                await Wishlist.findOneAndUpdate(
                    { userId: userId },
                    { $addToSet: { products: { productId } } },
                    { new: true }
                );

            } else {
                console.log('Product already in wishlist:', productId);
            }
        }

        res.render('wishlist', { wishlist });

    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    }
};


const removeFromWishlist = async (req, res) => {
    try {

        const userId = req.session.user;
        const productId = req.body.productId;


        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }


        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId: userId },
            { $pull: { products: { productId: productId } } },
            { new: true }
        );

        if (!updatedWishlist) {
            return res.status(400).json({ success: false, message: 'Failed to remove product from wishlist' });
        }


        return res.status(200).json({ success: true, wishlist: updatedWishlist });

    } catch (error) {
        console.error('Error removing product from wishlist:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const loadSearch = async (req, res) => {


    try {
        const query = req.query.query || '';
        
        const categoryId = req.query.category || '';
        const sortBy = req.query.sort || 'relevance';

        let filter = {};

        if (categoryId) {
            filter.category = categoryId;
        }

        if (query) {
            filter.productName = { $regex: query, $options: "i" };
        }

        let sort = {};
        if (sortBy === 'price-low') {
            sort = { 'stock.price': 1 };
        } else if (sortBy === 'price-high') {
            sort = { 'stock.price': -1 };
        } else if (sortBy === 'rating') {
            sort = { 'rating': -1 };
        }

        const products = await Product.find(filter).populate('category').sort(sort);

        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found' });
        }

        const categories = await Category.find({ isListed: true, isDeleted: false });

        res.render("search", {
            products,
            categories,
            query,
            selectedCategory: categoryId,
            sortBy
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
}


const loadWallet = async (req, res) => {
    try {
        const user = req.session.user;
        
       const  WalletList =  await Wallet.find({user:user});
       
        return res.render('Wallet',{WalletList});
    } catch (error) {
        console.log(error);

    }
}

const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'Canceled' || order.status === 'Processing' || order.status === 'Shipped' || order.status === 'Pending') {
            return res.status(400).json({ success: false, message: "Order cannot be returned or canceled at this stage" });
        }


        order.status = 'Return Request';

        await order.save();

        return res.redirect('/Orderlist');
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}


    const returnItemOrder = async (req, res) => {
        try {
            const { orderId, productid } = req.params;
            const { returnReason, otherReasonText } = req.body;

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            const item = order.orderedItems.find(item => item.product._id.toString() === productid);
            if (!item) {
                return res.status(404).json({ success: false, message: "Item not found" });
            }

            if (order.status === 'Canceled' || order.status === 'Processing' || order.status === 'Shipped' || order.status === 'Pending') {
                return res.status(400).json({ success: false, message: "Item cannot be returned at this stage" });
            }
            const refundAmount = Math.min(item.price * item.quantity, order.totalPrice);

            const returnProduct = new Return({
                order: order._id,
                product: item.product,
                orderItemId: item._id,
                returnProductStatus: 'Return Request',
                productRefundAmount: refundAmount,
                productReturnReason: returnReason === 'Other' ? otherReasonText : returnReason,
                productReturnDate: Date.now(),
            });

            await returnProduct.save();

            order.status = 'Return Request';
            order.statusHistory.push({
                status: 'Return Request',
                updatedOn: Date.now()
            });
            await order.save();

            item.orderStatus = 'Return Request';  
            await order.save();



            const product = await Product.findById(item.product);
            
            if (product) {
                const productStock = product.stock.find(stock => stock.volume === item.volume);
                
                if (productStock) {
                    productStock.quantity += item.quantity;

                    await product.save();

                } else {
                    console.log(`No matching stock found for volume ${item.volume}`);
                }
            }

            return res.json({ success: true, message: 'Return request submitted successfully.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    };





module.exports = {

    loadHomepage,
    loadShopPage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,


    securePassword,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadProductPage,
    loadProfilePage,
    myaddressPage,


    OrderlistPage,
    editProfilePage,
    addAddressPage,
    saveAddress,
    deleteAddress,
    editAddressPage,


    updateAddress,
    editProfile,
    loadCartPage,
    addToCart,
    removeFromCart,
    loadcheckout,
    placeOrder,


    loadOrderConfirm,
    addTowishlist,
    removeFromWishlist,
    loadSearch,
    updateCart,
    removeItemFromOrder,
    applyCoupon,

    loadWallet,
    removeCoupon,
    returnOrder,
    returnItemOrder,
    getInvoice
    




}