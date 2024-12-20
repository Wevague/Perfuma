const mongoose = require("mongoose");
const {Schema} = mongoose;

const stockSchema = new Schema ({
  volume : {
    type : String,
    required: true 
  },
  quantity : {
    type : Number
  },
  price :{
    type:Number,
    require:true,
  } ,

},{_id:false})

const productSchema = new Schema({
    productName : {
        type: String,
        required:true,
        
    },
    description: {
        type :String,
        required:true,
    },
    category: {
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    WishList:{
        type:Boolean,
        required:false,
    },
    productOffer : {
        type:Number,
        default:0,
    },
    productOfferName:{
        type:String,
        
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    productImage:{
        type:[String],
        required:true,
    },
    stock : [stockSchema],
    isBlocked:{
        type:Boolean,
        default:false,
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;