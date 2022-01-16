const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Test = require("../models/Test");
const Leaderboard=require("../models/Leaderboard")

const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.SECRET;

const fetchuser = require("../middleware/fetchUser");
const fetchemail = require("../middleware/fetchEmail");

const transporter = require("../nodeMailer");
var passwordGenerator = require("generate-password");
var otpSet = {};

const sendEmailForVerification = async(email) => {

	const salt = await bcrypt.genSalt(10);
	
	let emailHash = await bcrypt.hash(email, salt);
	
	const emailData = {
		email: {
			email: email,
		},
	};
	emailHash = jwt.sign(emailData, JWT_SECRET);

	const options = {
		from: process.env.EMAILUSERNAME,
		to: email,
		subject: "Email verification of TypeIt",
		html: `<h2>Click on <a href="https://typeit-mongodb.herokuapp.com/api/auth/verifyemail/${emailHash}">this</a> link to verify your account</h2>`,
		// html: `<h2>Click on <a href="http://localhost:5000/api/auth/verifyemail/${emailHash}">this</a> link to verify your account</h2>`,
	};

	return new Promise((resolve,reject)=>{
		
		transporter.sendMail(options, function(err, info) {
			if (err) {
				// console.log(err);
				resolve(false);
			}
			// console.log("Sent : "+info.response);
			resolve(true)
		});
		return;
	})
};

const sendNewPasswordEmail = async(email, password) => {
	const options = {
		from: process.env.EMAILUSERNAME,
		to: email,
		subject: "New password for your typeit account",
		html: `<p>Your new password is <b>${password}</b>, it will expire in few minutes, login with it and to change to new password visit edit options available in user section at typeit.</p>`,
	};
	return new Promise((resolve,reject)=>{
		
		transporter.sendMail(options, function(err, info) {
			if (err) {
				// console.log(err);
				resolve(false)
			}
			// console.log("Sent : "+info.response);
			resolve(true)
		});
	})
};

const deleteOtpAfterGivenTime = (email) => {
    setTimeout(() => {
        delete otpSet[email];
    }, 300000);
};

// Route 1 to create a new user
router.post(
    "/createuser", [
        body(
            "fName",
            "Name should have atleast length 3 and atmost length 20"
        ).isLength({ min: 3, max: 20 }),
        body(
            "userName",
            "Username should have atleast length 3 and atmost length 15"
        ).isLength({ min: 3, max: 15 }),

        body("email", "Enter a valid email").isEmail(),
        body("password", "Password must be atleast 5 character").isLength({
            min: 5,
            max: 20,
        }), //this all are express validators
    ],
    async(req, res) => {
        let success = false;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors });
        }

        try {
            let user = await User.findOne({ userName: req.body.userName });
            if(user){                
                return res.status(400).json({
                    success,
                    error: "User name unavailable",
                });
            }
            user=await User.findOne({email:req.body.email})
            if (user && user.status !== 0) {
                return res.status(400).json({
                    success,
                    error: "Sorry a user with this email already registered with our site",
                });
            } else if (user && user.status === 0) {
                // here deleting user for fake account
                let user = await User.deleteOne({ email: req.body.email });
            }

            const salt = await bcrypt.genSalt(10);
            const secPass = await bcrypt.hash(req.body.password, salt);
            // console.log(`Insert into Users(userName,fName,lName,email,password,dateOfAccountCreated) VALUES ("${req.body.userName}","${req.body.fName}","${req.body.lName}","${req.body.email}","${secPass}","${new Date().toISOString().split('T')[0]}")`)
            user = await User.create({
                userName: req.body.userName,
                fName: req.body.fName,
                lName: req.body.lName,
                email: req.body.email,
                password: secPass,
            });

            await user.save();

            // await sendEmailForVerification(req.body.email);
            // uncomment above line if needed to wait till email is send
            sendEmailForVerification(req.body.email);
            success = true;
            res.json({ success });
        } catch (error) {
            // console.error(error.message);
            res.status(500).send("Some error occured");
        }
    }
);

// Route 2 for login of a user
router.post(
    "/login", [
        body(
            "userName",
            "Username should have atleast length 3 and atmost length 15"
        ).isLength({ min: 3, max: 15 }),
        body("password", "Password cannot be blank").exists(),
    ],
    async(req, res) => {
        let success = false;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors: errors.array() });
        }
        const { userName, password } = req.body;
        
        try {
            let user = (await User.findOne({ userName }).select("-__v -dateOfAccountCreated").populate({path:"tests",select:"-user -_id -__v -userName"}).populate({path:"bests",select:"-user -_id -__v -userName"}))
            if (!user) {
                return res.status(400).json({
                    success,
                    error: "Please try to login with correct credentials",
                });
            }
            const otp = otpSet[user.email];
            if (user.status === 0) {
                // await sendEmailForVerification(user.email);
                sendEmailForVerification(user.email);
                return res.status(400).json({
                    success,
                    error: "Please verify your account first and then login, email has been sent again, check you spam box also in case you don't find it",
                });
            }

            let passwordCompare = await bcrypt.compare(password, user.password);

            if (!passwordCompare && otp === undefined) {
                return res.status(400).json({
                    success,
                    error: "Please try to login with correct credentials",
                });
            } else if (!passwordCompare) {
                passwordCompare = await bcrypt.compare(password, otp);
                if (!passwordCompare) {
                    return res.status(400).json({
                        success,
                        error: "Please try to login with correct credentials",
                    });
                } else {
                    user.password=otp;
					await user.save()
                }
            }

            // delete user[password];

            const data = {
                user: {
                    id: user._id,
                },
            };

            const authtoken = jwt.sign(data, JWT_SECRET);
            success = true;
            
            res.json({ success, authtoken, user });
        } catch (error) {
            console.error(error.message);
            res.status(500).send("Internal Server error occured");
        }
    }
);

// Route 3 for logged in user details using post req /getuser
router.post("/getuser", fetchuser, async(req, res) => {
    let success = false;
    try {
        let userId = req.user.id;
        let user = await User.findById(userId).select(" -__v -dateOfAccountCreated").populate({path:"tests",select:"-user -_id -__v -userName"}).populate({path:"bests",select:"-user -_id -__v -userName"})
        success = true;
        res.send({ success, user });
    } catch (error) {
        // console.error(error.message);
        res.status(500).send("Inter Server error occured");
    }
});
// Route 4 for logged in user update using post req /updateuser
router.post("/updateuser", fetchuser, async(req, res) => {
    let success = false;
    try {
        let userId = req.user.id;
        let {
            numberOfTestsGiven,
            totalTimeSpend,
            bestSpeed,
            averageSpeed,
            bestAccuracy,
            averageAccuracy,
        } = req.body;
        let user = await User.findByIdAndUpdate(userId, {
            numberOfTestsGiven,
            totalTimeSpend,
            bestSpeed,
            averageSpeed,
            bestAccuracy,
            averageAccuracy,
        });
        success = true;
        res.send({ success });
    } catch (error) {
        // console.error(error.message);
        res.status(500).send("Inter Server error occured");
    }
});

// Route 5 for logged in user update of name username all that
router.post(
    "/updateusernames",
    fetchuser, [
        body(
            "fName",
            "Name should have atleast length 3 and atmost length 20"
        ).isLength({ min: 3, max: 20 }),
        body(
            "userName",
            "Username should have atleast length 3 and atmost length 15"
        ).isLength({ min: 3, max: 15 }),
    ],
    async(req, res) => {
        let success = false;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors });
        }
        try {
            let userId = req.user.id;
            let { userName, fName, lName } = req.body;
            let user = await User.findByIdAndUpdate(userId, {
                userName,
                fName,
                lName,
            });
            await Test.updateMany({_id:{$in: user.bests}},{userName:userName})
            success = true;
            res.send({success});
        } catch (error) {
            // console.error(error);
            if(error.codeName==="DuplicateKey"){
                return res.status(500).send({success,error:"User name is not available"});
            }
            return res.status(500).send({success,error:"Inter Server error occured"});
        }
    }
);

// Route 6 for logged in user update password
router.post(
    "/updatepassword",
    fetchuser, [
        body("currPassword", "Password must be atleast 5 character").isLength({
            min: 5,
            max: 20,
        }), //this all are express validators
        body("updatedPassword", "Password must be atleast 5 character").isLength({
            min: 5,
            max: 20,
        }), //this all are express validators
    ],
    async(req, res) => {
        let success = false;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors });
        }

        try {
            let userId = req.user.id;
            let { currPassword, updatedPassword } = req.body;
            let user = await User.findById(userId);
            if (!user) {
                return res.status(400).json({ success, error: "Something went wrong" });
            }
            const passwordCompare = await bcrypt.compare(currPassword, user.password);
            if (!passwordCompare) {
                return res.status(400).json({ success, error: "Something went wrong" });
            }

            const salt = await bcrypt.genSalt(10);
            const secPass = await bcrypt.hash(updatedPassword, salt);

            user.password = secPass;
            await user.save();

            delete otpSet[user.email];
            success = true;
            res.send({ success });
        } catch (error) {
            // console.error(error.message);
            res.status(500).send("Inter Server error occured");
        }
    }
);

router.get("/verifyemail/:id", fetchemail, async(req, res) => {
    try {
        const { email } = req;
        let user=await User.findOneAndUpdate({email}, {status:1});
        success = true;
        // res.redirect("https://type--it.herokuapp.com/login")
        // res.send("done perfectly");
        res.sendFile(__dirname+"/verificationSuccess.html")
    } catch (error) {
        // console.error(error.message);
        res.send("Some error occured please try after some time");
    }

});

router.post(
    "/deleteuser",
    fetchuser, [
        body("currPassword", "Password must be atleast 5 character").isLength({
            min: 5,
            max: 20,
        }), //this all are express validators
    ],
    async(req, res) => {
        let success = false;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors });
        }

        try {
            let userId = req.user.id;
            let { currPassword } = req.body;
            let user = await User.findById(userId);
            if (!user) {
                return res.status(400).json({ success, error: "Something went wrong" });
            }
            const passwordCompare = await bcrypt.compare(currPassword, user.password);

            if (!passwordCompare) {
                return res.status(400).json({ success, error: "Something went wrong" });
            }
            await Leaderboard.updateMany({},{$pull :{"tests" :{$in :user.bests}}})
            await Test.deleteMany({ user: userId });
            await User.findByIdAndDelete(userId);

            success = true;
            res.send({ success });
        } catch (e) {
			console.log(e)
            res.status(500).send("Internal Server error occured");
        }
    }
);

router.post(
    "/forgotpassword", [body("email", "Enter a valid email").isEmail()],
    async(req, res) => {
        let success = false;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success, errors: errors.array() });
        }
        const { email } = req.body;
        try {
            let user = await User.findOne({email});
            if (!user) {
                return res.status(400).json({ success, error: "Invali Credentials" });
            }

            var newPassword = await passwordGenerator.generate({
                length: 14,
                numbers: true,
                symbols: true,
                strict: true,
                excludeSimilarCharacters: true,
            });
			
            const salt = await bcrypt.genSalt(10);
            const secPass = await bcrypt.hash(newPassword, salt);

            sendNewPasswordEmail(req.body.email, newPassword);
            // await sendNewPasswordEmail(req.body.email, newPassword);
			
            otpSet[email] = secPass;
            deleteOtpAfterGivenTime(email);

            success = true;
            // console.log(user)
            res.send({ success });
        } catch (error) {
            // console.error(error.message);
            res.status(500).send("Internal Server error occured");
        }
    }
);
module.exports = router;