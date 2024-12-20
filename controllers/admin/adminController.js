const User = require('../../models/userSChema');
const Order = require('../../models/orderSchema')
const coupons = require('../../models/couponSchema');
const Return = require('../../models/orderReturnSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');





const pageerror = (req, res) => {
    const errorMessage = 'An unexpected error occurred.';
    res.render('admin-error', { message: errorMessage });
};






const loadLogin = (req, res) => {
    console.log('load admin login')
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin-login', { message: null })
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);

            if (passwordMatch) {
                req.session.admin = admin._id;
                return res.redirect('/admin/dashboard')
            } else {
                return res.redirect('/admin/login');
            }
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log('login error', error);
        return res.redirect('/pageerror')

    }
}





const loadDashboard = async (req, res) => {
    try {
        const [topProducts, topCategories, yearlySales, monthlySales, weeklySales] = await Promise.all([
            Order.aggregate([
                { $unwind: "$orderedItems" },
                {
                    $group: {
                        _id: "$orderedItems.product",
                        totalSold: { $sum: "$orderedItems.quantity" }, 
                    },
                },
                { $sort: { totalSold: -1 } }, 
                { $limit: 10 }, 
                {
                    $lookup: {
                        from: "products", 
                        localField: "_id",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: "$productDetails" }, 
                {
                    $project: {
                        name: "$productDetails.productName", 
                        totalSold: 1,
                    },
                },
            ]),

            Order.aggregate([
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products", 
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: "$productDetails" }, 
                {
                    $group: {
                        _id: "$productDetails.category", 
                        totalSold: { $sum: "$orderedItems.quantity" }, 
                    },
                },
                { $sort: { totalSold: -1 } }, 
                { $limit: 10 }, 
                {
                    $lookup: {
                        from: "categories", 
                        localField: "_id",
                        foreignField: "_id",
                        as: "categoryDetails",
                    },
                },
                { $unwind: "$categoryDetails" }, 
                {
                    $project: {
                        name: "$categoryDetails.name",
                        totalSold: 1,
                    },
                },
            ]),

            // Yearly Sales
            Order.aggregate([
                {
                    $group: {
                        _id: { $year: "$createdOn" },
                        totalSales: { $sum: "$totalPrice" },
                        orderCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Monthly Sales 
            Order.aggregate([
                {
                    $group: {
                        _id: { 
                            year: { $year: "$createdOn" },
                            month: { $month: "$createdOn" }
                        },
                        totalSales: { $sum: "$totalPrice" },
                        orderCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // Weekly Sales
            Order.aggregate([
                {
                    $group: {
                        _id: { 
                            year: { $year: "$createdOn" },
                            week: { $week: "$createdOn" }
                        },
                        totalSales: { $sum: "$totalPrice" },
                        orderCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.week': 1 } }
            ])
        ]);

      
        const salesData = {
            yearly: yearlySales.map(item => ({
                label: item._id.toString(),
                sales: item.totalSales,
                orders: item.orderCount
            })),
            monthly: Array.from({ length: 12 }, (_, monthIndex) => {
                const monthLabel = new Date(2024, monthIndex).toLocaleString('default', { month: 'long' });
                const monthYearData = monthlySales.find(item => item._id.month === (monthIndex + 1));
                return {
                    label: `${monthLabel} ${2024}`, 
                    sales: monthYearData ? monthYearData.totalSales : 0, 
                    orders: monthYearData ? monthYearData.orderCount : 0
                };
            }),
            weekly: weeklySales.map(item => ({
                label: `Week ${item._id.week}, ${item._id.year}`,
                sales: item.totalSales,
                orders: item.orderCount
            }))
        };

    
        
        

        res.render("Dashboard", { 
            topProducts, 
            topCategories, 
            salesData: JSON.stringify(salesData)
        });
    } catch (err) {
        console.error("Error in loadDashboard:", err);
        res.status(500).send("Server Error");
    }
};



const loadOrderListpage = async (req, res) => {
    try {

        const orderId = req.params.orderId;

        
        
        const page = parseInt(req.query.page) || 1;
        const pageSize = 5;

        const skip = (page - 1) * pageSize;

        const orders = await Order.find().populate('user')
            .populate('orderedItems.price')
            .populate('orderedItems.product')
            .populate('address')
            .sort({ createdOn: -1 }).skip(skip)
            .limit(pageSize);


        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / pageSize);

        res.render('oredersLIst', {
            orders, currentPage: page,
            totalPages
        });



    } catch (error) {

        console.log(error);


    }
}


const showOrder = async (req, res) => {
    try {
        const {orderId} = req.query;
        
        
        if (!orderId) {
            return res.status(400).send("No Order ID provided");
        }

        
        const orders = await Order.findById(orderId).populate('orderedItems.product').populate('address').populate('user');
        if (!orders) {
            return res.status(404).send("Order not found");
        }

        
        
        return res.render('viewOrder',{orders});
        
    } catch (err) {
        console.error('Error in showOrder:', err);
        res.status(500).send("Server error");
    }
}




const updateOrderStatus = async (req, res) => {

    const { orderId, newStatus, productId } = req.body;
    try {


        const order = await Order.findById(orderId);

        if (!orderId) {
            return res.status(404).json({ success: false, message: 'Order not found' });

        }

        const orderedItem = order.orderedItems.find(item => item.product.toString() === productId);

        if (orderedItem) {
            orderedItem.orderStatus = newStatus;
        }

        await order.save();


        res.status(200).json({ success: true, message: 'Order status updated successfully' });


    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });

    }
}






const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;


        const order = await Order.findByIdAndUpdate(orderId, { status: "cancelled" }, { new: true });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({ success: true, message: "Order cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const AdminLogout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
               console.log(err)
                return res.redirect('/admin-error');
            }
             res.redirect('/admin/login');
        })
    } catch (error) {
        console.log('logout error', error);
        res.redirect('/admin-error')

    }
}


const Coupon = async (req, res) => {

    try {
        const couponList = await coupons.find();

        return res.render('manageCoupon', { coupons: couponList });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error loading coupons');
    }
}


const loadAddCoupon = async (req, res) => {
    try {

        return res.render('addToCoupon');

    } catch (error) {
        console.log(error);


    }
}

const addCoupon = async (req, res) => {

    try {
        const { name, description, code, discount, minPurchase, maxDiscount } = req.body;

        const userId = req.session.user;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User is not authenticated" });
        }

        const newcoupon = new coupons({
            name: name,
            description: description,
            code: code,
            discountPercentage: discount,
            maxDiscount: maxDiscount,
            minAmount: minPurchase,
            usedBy: [userId],

        });




        await newcoupon.save();

        return res.redirect('/admin/manageCoupon');

    } catch (error) {
        console.log(error);
        res.status(500).send('Error adding coupon');


    }
}

const couponDelete = async (req, res) => {
    
    const  {couponId}  = req.query;
    try {

        if (!couponId) {
            return res.status(400).json({
                message: 'Coupon ID is required'
            });
        }

        const result = await coupons.findByIdAndDelete(couponId);

        if (!result) {
            return res.status(404).json({
                message: 'Coupon not found'
            });
        }


        return res.redirect('/admin/manageCoupon')

    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}


const returnOrder = async (req, res) => {

    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 4;

        const skip = (page - 1) * pageSize;

        const returnData = await Return.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate([
            {
                path: 'order',
                populate: {
                    path: 'user'
                }
            },
            {
                path: 'product'
            }
        ]);
            

        const totalItems = await Return.countDocuments();

        const totalPages = Math.ceil(totalItems / pageSize);

        return res.render('returnOrder', {
            returnData,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching return orders:', error);
        return res.status(500).send('Something went wrong');
    }
}


const acceptReturnOrder = async (req, res) => {
    const { orderId, productid } = req.body;
    
    try {
        const returnRecord = await Return.findOne({ product: productid });
        console.log("returnRecord", returnRecord);
     

        if (!returnRecord) {
            return res.status(404).json({ success: false, message: 'Return request not found.' });
        }

        returnRecord.returnProductStatus = 'Return Approved';

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const orderedItem = order.orderedItems.find(item => item.product.toString() === productid.trim());        

        if (!orderedItem) {
            return res.status(404).json({ success: false, message: 'Ordered item not found.' });
        }

        orderedItem.orderStatus = 'Returned';

        order.statusHistory.push({
            status: 'Returned',
            updatedOn: new Date()
        });

        await order.save();
      

        await returnRecord.save();

        
        const refundAmount = Math.min(orderedItem.price * orderedItem.quantity, order.totalPrice);



        let wallet = await Wallet.findOne({ user: order.user });



        if (!wallet) {
            wallet = new Wallet({
                user: order.user,
                balance: 0,
                transactions: []
            });
            await wallet.save();
           
        }

        wallet.balance += refundAmount;

        wallet.transactions.push({
            amount: refundAmount,
            status: 'success',
            type: 'credit',
            orderId: order._id,
            description: `Refund for returned item ${orderedItem.productName}`
        });


        await wallet.save();


        res.json({ success: true, message: 'Return accepted successfully.' });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Something went wrong');
    }
};



const rejectReturnOrder = async (req, res) => {

    const { orderId, productid } = req.body;

    try {
        const returnCancel = await Return.findOne({ product: productid  });

        if (!returnCancel) {
            return res.status(404).json({ success: false, message: 'Return request not found.' });
        }

        returnCancel.returnProductStatus = 'returnRejected';

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        order.orderedItems.forEach(item => {
            if (item.product.toString() === productid.trim()) {
                item.orderStatus = 'returnRejected';
            }
        });

        order.statusHistory.push({
            status: 'returnRejected',
            updatedOn: new Date()
        });

        await returnCancel.save();
        await order.save();

        res.json({ success: true, message: 'Return rejected successfully.' });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Something went wrong');
    }
};





module.exports = {


    loadLogin,
    login,
    loadDashboard,
    pageerror,
    loadOrderListpage,
    updateOrderStatus,
    cancelOrder,
    AdminLogout,
    Coupon,
    loadAddCoupon,
    addCoupon,
    couponDelete,
    returnOrder,
    acceptReturnOrder,
    rejectReturnOrder,
    showOrder

   
}
