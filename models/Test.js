const mongoose=require("mongoose")

const TestSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    userName:{
        type:String,
        required:true
    },
    language:{
        type:String,
        required:true
    },
    testTime:{
        type:Number,
        required:true
    },
    timeOfTest:{
        type:Date,
        default:Date.now
    },
    speed:{
        type:Number,
        required:true
    },
    accuracy:{
        type:Number,
        required: true
    }
    
})

module.exports=mongoose.model("test",TestSchema)