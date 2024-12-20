

const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        volume: {
            type: String,
            required: true
        },
        orderStatus: {
            type: String,
            enum: ["Pending", 'initiated','payment failed', "Shipped", "Delivered", "Returned", "Canceled", 'Return Request', 'Return Approve', 'returnRejected', 'confirmed'],
            default: "Pending",
        },
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: 'address',
        required: true
    },
    invoiceDate: {
        type: Date
    },

    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    couponAmount: {
        type: Number,
        require: false
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'UPI', 'COD', 'wallet', 'Paypal'],
    },
    transactionId: {
        type: String,
        unique: true
    },
    paypalOrderId: {
        type: String,
        unique: true
    },
    paypalOrderStatus: {
        type: String,
        enum: ['initiated', 'completed','Canceled','payment failed']
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['Pending', 'initiated', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Return Request', 'Returned', 'returnRejected', 'confirmed','payment failed'],
            default: 'Pending'
        },
        updatedOn: {
            type: Date,
            default: Date.now
        }
    }],
}, { timestamps: true }); // Add timestamps here

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
