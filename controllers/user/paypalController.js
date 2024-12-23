const {
    ApiError,
    CheckoutPaymentIntent,
    Client,
    Environment,
    LogLevel,
    OrdersController,
    PaymentsController,
} = require("@paypal/paypal-server-sdk");
const User = require('../../models/userSChema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema');
const coupons = require('../../models/couponSchema');

const {
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
} = process.env;

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: PAYPAL_CLIENT_ID,
        oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
    timeout: 0,
    environment: Environment.Sandbox,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
});
const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (orderAmount) => {
    console.log(PAYPAL_CLIENT_ID)
    const collect = {
        body: {
            intent: "CAPTURE",
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "USD",
                        value: String(orderAmount.toFixed(2)),
                    },
                },
            ],
        },
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCreate(
            collect
        );
        // Get more response info...
        // const { statusCode, headers } = httpResponse;
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        console.log(error)
        if (error instanceof ApiError) {
            // const { statusCode, headers } = error;
            throw new Error(error.message);
        }
    }
};

// createOrder route
const manageOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { payment, selectedAddress, totalAmount, finalAmount,couponCode } = req.body;
        console.log("couponCode",couponCode);
        
        
        console.log("selectedAddress",selectedAddress)
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("User not found");
        }

        const selectedAddressDetails = user.address.find(addr => addr._id.toString() === selectedAddress);

        if (!selectedAddressDetails) {
            return res.status(400).send("Invalid address selected");
        }

        const totalPrice =  Math.floor(req.session.totalAmount);
        let discountAmount=0;

        if (couponCode) {
            const coupon = await coupons.findOne({ code: couponCode, isActive: true });
            if (!coupon) {
                return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
            }
            if (coupon.expirationDate && new Date() > coupon.expirationDate) {
                return res.status(400).json({ success: false, message: "Coupon has expired" });
            }
            if (totalPrice < coupon.minAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Coupon requires a minimum purchase of ₹${coupon.minAmount}`
                });
            }
            if (coupon.usageLimit > 0 && coupon.usedBy.length >= coupon.usageLimit) {
                return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
            }

            discountAmount = (totalPrice * coupon.discountPercentage) / 100;
            const discountAmountClamped = Math.min(discountAmount, coupon.maxDiscount);
            discountAmount = discountAmountClamped; 
            
            coupon.usedBy.push(userId);
            await coupon.save();

        }


        const cart = await Cart.findOne({ userId: userId });
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).send("Cart is empty");
        }
        
        // console.log("totalPrice", totalPrice);


        const orderedItems = cart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.stock.price,
            productImage: item.productImage,
            totalPrice: item.totalPrice,
            volume: item?.stock?.volume,
            orderStatus: "initiated"
        }));

        const transactionId = `TRANS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

            } else {
                return res.status(400).json({ success: false, message: `Stock variant not found for ${product.productName}` });
            }

        }


        req.session.cartItems = [];
        req.session.totalPrice = 0;

        const convertedTotalPrice = Math.round(totalPrice / 83.2);

        console.log("convertedTotalPrice",convertedTotalPrice);
        


        const { jsonResponse, httpStatusCode } = await createOrder(convertedTotalPrice);

        const order = new Order({
            user: userId,
            orderedItems: orderedItems,
            totalPrice: totalPrice,
            paypalOrderId: jsonResponse.id,
            address: selectedAddressDetails._id,
            paymentMethod: 'Paypal',
            paypalOrderStatus: "initiated",
            createdOn: new Date(),
            transactionId: transactionId,
            discount: discountAmount
           

        });
        await order.save();
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to create order." });
    }
}

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
    const collect = {
        id: orderID,
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCapture(
            collect
        );

        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw new Error(error.message);
        }
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { orderID } = req.params;
        const userId = req.session.user;
        const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
        if (jsonResponse.status === 'COMPLETED') {
            const order = await Order.findOne({ paypalOrderId: orderID })
            const orderedItems = order.orderedItems
            for (let item of orderedItems) {
                item.orderStatus = 'Pending'
            }
            order.paypalOrderStatus = 'completed'
            await order.save()

            const cart = await Cart.findOne({ userId: userId });
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).send("Cart is empty");
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

            await Cart.updateOne({ userId: userId }, { $set: { items: [] } });

            req.session.cartItems = [];
            req.session.totalPrice = 0;

        }
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to capture order." });
    }
}


const CancelPayment = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    console.log(orderId, status);

    try {
        const order = await Order.findOne({ paypalOrderId: orderId });


        console.log(order);
        

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.paypalOrderStatus = 'payment failed';

        order.orderedItems.forEach(item => {
            item.orderStatus = 'Pending'; 
        });

        order.statusHistory.push({
            status: 'payment failed',
            updatedOn: new Date(),
        });

        await order.save();

        res.json({ success: true, message: 'Order and item statuses updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



const retryPayment = async (req, res) => {
    const { orderId } = req.params;
    console.log(orderId);
    
    try {
        const order = await Order.findOne({ paypalOrderId: orderId });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId: userId });

        if (cart) {
            cart.items = []; 
            await cart.save();
        }

        req.session.cartItems = []; 
        req.session.totalPrice = 0; 
        res.json({
            id: order.paypalOrderId,
            selectedAddress: order.address,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to retrieve order details' });
    }
}


const captureRetryPayment = async (req, res) => {
    const { orderId } = req.params;

    console.log(orderId);
    

    try {
        const order = await Order.findOne({ paypalOrderId: orderId });

        console.log(order);
        
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const { jsonResponse, httpStatusCode } = await captureOrder(order.paypalOrderId);

        if (jsonResponse.status === 'COMPLETED') {
            order.paypalOrderStatus = 'completed';
            order.orderedItems.forEach(item => {
                item.orderStatus = 'Pending';
            });
            await order.save();

            res.status(httpStatusCode).json(jsonResponse);
        } else {
            res.status(400).json({ success: false, message: 'Payment capture failed' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error during payment capture' });
    }
}

// const CancelPayment = async (req, res) => {
//     try {
//       const { orderID } = req.query; 
      
//         console.log("orderIDq",orderID);
        
//       if (!orderID) {
//         return res.status(400).json({ message: 'Order ID is required' });
//       }
  
//       const order = await Order.findOne({ paypalOrderId: orderID });

//       console.log("order",order);
      
  
//       if (!order) {
//         return res.status(404).json({ message: 'Order not found' });
//       }
  
//       order.paypalOrderStatus = 'Canceled';
  
//       order.statusHistory.push({
//         status: 'Canceled',
//         updatedOn: new Date(),
//       });
  
//       await order.save();
  
//       return res.render('payemtretry',{ orderId: orderID }); 
  
//     } catch (error) {
//       console.error('Error handling cancel payment:', error);
//       return res.status(500).json({ message: 'Internal server error' });
//     }
//   };

//   const RetryPayment = async (req, res) => {
//     try {
//         const { orderID } = req.params;


//         console.log(orderID);
        

//         if (!orderID) {
//             return res.status(400).send('Order ID is missing.');
//         }

//         console.log('Received Order ID:', orderID);

//         const order = await Order.findOne({ paypalOrderId: orderID });

//         console.log(order);
        
        
//         if (!order) {
//             return res.status(404).send('Order not found.');
//         }

//         if (order.paypalOrderStatus !== 'Canceled') {
//             return res.status(400).send('Order has not been canceled.');
//         }

//         const totalAmount = order.totalPrice; 
//         const { jsonResponse, httpStatusCode } = await createOrder(totalAmount / 83.2); 

//         if (httpStatusCode !== 201) {
//             return res.status(httpStatusCode).json(jsonResponse);
//         }

//         order.paypalOrderId = jsonResponse.id;
//         order.paypalOrderStatus = 'initiated'; 
//         await order.save();

//         return res.json(jsonResponse);

//     } catch (error) {
//         console.error('Error in retry payment:', error);
//         return res.status(500).send('Internal Server Error');
//     }
// };


// const captureRetryPayment = async (req, res) => {
//     try {
//         const { orderID } = req.params;

//         console.log(orderID);
        
//         const userId = req.session.user;

//         if (!orderID) {
//             return res.status(400).json({ error: 'Order ID is required' });
//         }

//         const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
//         console.log("Capture Order Response:", jsonResponse, httpStatusCode);

//         if (jsonResponse.status === 'COMPLETED') {
//             const order = await Order.findOne({ paypalOrderId: orderID });

//             if (!order) {
//                 return res.status(404).json({ error: 'Order not found' });
//             }

//             order.orderedItems.forEach(item => {
//                 item.orderStatus = 'Pending';
//             });
//             order.paypalOrderStatus = 'completed';
//             await order.save();

//             const cart = await Cart.findOne({ userId: userId });
//             if (!cart || !cart.items || cart.items.length === 0) {
//                 return res.status(400).send("Cart is empty");
//             }

//             for (let item of cart.items) {
//                 const product = await Product.findById(item.productId);
//                 if (!product) {
//                     return res.status(404).json({ success: false, message: "Product not found" });
//                 }

//                 if (product.isBlocked) {
//                     return res.status(400).json({
//                         success: false,
//                         message: `The product "${product.productName}" is no longer available for purchase.`
//                     });
//                 }

//                 const stockVariant = product.stock.find(stock => stock.volume === item.stock.volume);
//                 if (stockVariant) {
//                     if (stockVariant.quantity < item.quantity) {
//                         return res.status(400).json({ success: false, message: `Insufficient stock for ${product.productName} (${stockVariant.volume})` });
//                     }

//                     stockVariant.quantity -= item.quantity;
//                 } else {
//                     return res.status(400).json({ success: false, message: `Stock variant not found for ${product.productName}` });
//                 }

//                 await product.save();
//             }

//             await Cart.updateOne({ userId: userId }, { $set: { items: [] } });

//             req.session.cartItems = [];
//             req.session.totalPrice = 0;

//             return res.status(200).json({ 
//                 message: 'Payment successful', 
//                 orderID: order._id 
//             });
//         } else {
//             return res.status(400).json({ 
//                 error: 'Payment not completed', 
//                 status: jsonResponse.status 
//             });
//         }

//     } catch (error) {
//         console.error('Error capturing retry payment:', error);
//         return res.status(500).json({ error: 'Failed to capture payment' });
//     }
// };




module.exports = {
    manageOrder,
    verifyPayment,
    // retryPayment
    CancelPayment,
    retryPayment,
    captureRetryPayment
    // CancelPayment,
    // RetryPayment,
    // captureRetryPayment
}