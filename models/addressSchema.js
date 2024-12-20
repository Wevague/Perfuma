


const mongoose = require('mongoose');
const {Schema} = mongoose;

const addressModel = new mongoose.Schema({
    addressType: {
                type: String,
                required: true
            },
    name:{
        type:String,
        require:true
    },
    phone:{
        type:String,
        require:true
    },
    pincode:{
        type:String,
        require:true
    },
   state:{
    type:String,
    require:true
   },
   city:{
    type:String,
    require:true
   },
   addressLine1: {
            type: String,
            required: true
        },

})


module.exports = mongoose.model('address',addressModel)