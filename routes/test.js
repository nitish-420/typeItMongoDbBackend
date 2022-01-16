const express=require('express')
const router=express.Router()

const {body,validationResult}=require('express-validator')

const fetchuser=require("../middleware/fetchUser")

const User = require("../models/User");
const Test = require("../models/Test");
const Leaderboard=require("../models/Leaderboard")


router.post("/createtest",fetchuser,[
    body('time','Not a valid time option').isLength({max:3}),
    ],async (req,res)=>{
        let success=0;
        const errors=validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({success,errors})
        }
        const {testTime,speed,accuracy,language,numberOfTestsGiven,totalTimeSpend,bestSpeed,averageSpeed,bestAccuracy,averageAccuracy}=req.body;
    
        try{
            const userId=req.user.id
            const user=await User.findById(userId).populate("bests")
            let test=new Test({
                testTime,speed,accuracy,language,
                timeOfTest:new Date(),
                user:req.user.id,
                userName:user.userName
            })

            const savedTest=await test.save()
            let bestIndex=-1;
            for(let i=0;i<user.bests.length;i++){
                if(user.bests[i].testTime===parseInt(testTime) && user.bests[i].language===language){
                    bestIndex=i;
                    break;
                }
            }
            if((bestIndex===-1 )|| (user.bests[bestIndex].speed<parseInt(speed)) ||(user.bests[bestIndex].speed===parseInt(speed) && user.bests[bestIndex].accuracy<parseInt(accuracy))){
                user.bests.push(savedTest)
                await Leaderboard.findOneAndUpdate({language,time:testTime},{$push:{tests:savedTest._id}},{upsert:true})
                if(bestIndex!==-1){
                    await Leaderboard.findOneAndUpdate({language,time:testTime},{$pull:{tests:user.bests[bestIndex]._id}})
                    user.bests.splice(bestIndex,1);
                }
                success++;
            }
            user.tests.push(savedTest._id)
            user.numberOfTestsGiven=numberOfTestsGiven;
            user.totalTimeSpend=totalTimeSpend;
            user.bestSpeed=bestSpeed;
            user.averageSpeed=averageSpeed;
            user.bestAccuracy=bestAccuracy;
            user.averageAccuracy=averageAccuracy;
            await user.save();
            success++;
            res.json({success,savedTest})
        }
        catch(error){
            // console.error(error.message);
            res.status(500).send("Some error occured");
        }
    }

)


router.post("/getall",async (req,res)=>{
        let success=false;
        try{
            const language=req.body.language;

            var final={
                time15:[],
                time30:[],
                time60:[],
                time120:[]
            }

            
            let leaderboardData=await Leaderboard.find({language}).populate({path:"tests",select:"-user -_id -__v -language",sort:[{"speed":"desc","accuracy":"desc","timeOfTest":"asc"}]})        
            leaderboardData.forEach((data)=>final[`time${data.time}`]=data.tests)
            success=true;
            res.json({success,final})

        }
        catch(error){
            // console.error(error.message);
            res.status(500).send("Some error occured");
        }
    }

)


module.exports=router