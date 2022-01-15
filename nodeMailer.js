if(process.env.NODE_ENV!='production'){
    require('dotenv').config();
}
const nodemailer=require('nodemailer')

const transporter=nodemailer.createTransport({
    service:"hotmail",
    auth:{
        user:process.env.EMAILUSERNAME,
        pass:process.env.EMAILPASSWORD
    }
});


module.exports=transporter
