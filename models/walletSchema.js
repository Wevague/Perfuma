const {Schema,model} = require('mongoose');
const ObjectId = Schema.Types.ObjectId
const walletTransactions = new Schema({
    orderId: {
        type: ObjectId,
        ref: 'orders',
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    status: {  
        type: String,
        enum: [ 'pending', 'success', 'failed','debited'],
        default: 'pending'
    },
    type:{
        type:String,
        enum: ['debit', 'credit'],
    },
    razorpaymentId:{
        type:String,
    },
}, { timestamps: true });

const wallet = new Schema({
    user:{
        type:ObjectId,
        ref: 'userdatas',
        required: true
    },
    balance:{
        type:Number,
        required:true,
        default:0
    },
    transactions:[walletTransactions]
},{timestamps:true})

module.exports =  model('wallet',wallet)