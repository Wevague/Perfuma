


const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    password: {
        type: String,
        required: false  
    },
    googleId: {
        type: String,
        // unique:true,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    address:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'address'
    }],
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    // Wishlist: [{
    //     type: Schema.Types.ObjectId,
    //     ref: "Wishlist"
    // }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referlCode: {
        type: String
    },
    redeemed: {
        type: Boolean
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now 
        }
    }],
    
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
