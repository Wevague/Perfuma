
const User = require('../../models/userSChema');
const Order = require('../../models/orderSchema')
const coupons =require('../../models/couponSchema');
const Return = require('../../models/orderReturnSchema');
const Wallet = require('../../models/walletSchema');








const salesReport = async (req, res) => {
    try {
        const reportType = req.query.reportType || 'daily';
        const startDate = req.query.startDate; 
        const endDate = req.query.endDate; 

        let query = {};

        if (startDate && endDate) {
            query.createdOn = { 
                $gte: new Date(startDate), 
                $lte: new Date(endDate) 
            };
        } else {
            const now = new Date();
            switch (reportType) {
                case 'daily':
                    query.createdOn = {
                        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                        $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                    };
                    break;
                case 'weekly':
                    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                    query.createdOn = { 
                        $gte: weekStart,
                        $lte: now
                    };
                    break;
                case 'monthly':
                    query.createdOn = {
                        $gte: new Date(now.getFullYear(), now.getMonth(), 1),  
                        $lte: now
                    };
                    break;
                case 'yearly':
                    query.createdOn = {
                        $gte: new Date(now.getFullYear(), 0, 1),
                        $lte: now
                    };
                    break;
            }
        }

        const orders = await Order.find(query);

        const modifiedOrders = orders.map(order => {
            const activeItems = order.orderedItems.filter(item => item.orderStatus !== 'Canceled');
            order.orderedItems = activeItems;

            order.totalPrice = activeItems.reduce((sum, item) => {
                return sum + (item.price * item.quantity); 
            }, 0);

            return order.orderedItems.length > 0 ? order : null;
        }).filter(order => order !== null);

        const totalOrders = modifiedOrders.length;
        const totalAmount = modifiedOrders.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalDiscount = modifiedOrders.reduce((sum, order) => sum + order.discount, 0);
        const totalNetAmount = modifiedOrders.reduce((sum, order) => sum + (order.finalAmount || (order.totalPrice - order.discount)), 0);
        
        return res.render('salesReport', {
            orders: modifiedOrders,
            totalOrders,    
            totalAmount,
            totalDiscount,
            totalNetAmount,
            reportType,
            startDate,
            endDate,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Something went wrong');
    }
};




module.exports = {

    salesReport
}
