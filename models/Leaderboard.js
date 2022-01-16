const mongoose=require("mongoose")

const LeaderboardSchema=new mongoose.Schema({

    language:{
        type:String,
        required:true
    },
    time:{
        type:Number,
        required:true
    },
    tests:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'test'
    }]
})

const User=mongoose.model("leaderboard",LeaderboardSchema)
module.exports=User