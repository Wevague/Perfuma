const {Schema,model} = require('mongoose');
const ObjectId = Schema.Types.ObjectId

const returnProductSchema = new Schema({
    order:{
        type:ObjectId,
        required:true,
        ref:"Order"
    },
    product:{
        type:ObjectId,
        required:true,
        ref:'Product'
    },
    orderItemId:{
        type:ObjectId,
        required:true
    },
    returnProductStatus: {
        type: String,
        enum: ["Return Request","Return Approved","returnRejected"],
        default:"returnInitiated",
        required:true
      },
    productRefundAmount:{
        type:Number,
        min: 0,
        default:0,
        required:true
    },
    productReturnDate:{
        type:Date,
        default: Date.now(),
        required:true
    },
    productReturnReason:{
        type:String,
        required:true
    },
}, { timestamps: true });


module.exports = model('returnProduct', returnProductSchema);