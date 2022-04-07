const express = require("express");
const cors = require("cors");
const app = express();
const mysql = require('mysql');
const fs = require('fs');
const { Client,MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const bodyParser = require("body-parser");
const multer = require('multer');
const res = require("express/lib/response");
const SESSION_FILE_PATH = './session.json';
const { exec } = require("child_process");

app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

const db = mysql.createPool({
    host:"localhost",
    user:"root",
    password:"",
    database:"test"
});

//! Use of Multer
var storage = multer.diskStorage({
    destination: (req, file, callBack) => {
        callBack(null, 'images/')     // './public/images/' directory name where save the file
    },
    filename: (req, file, callBack) => {
        callBack(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})

var upload = multer({
    storage: storage
});

let sessionData;

if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

const client = new Client({
    session: sessionData,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    restartOnAuthFail: true, // related problem solution
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            //'--single-process', // <- this one doesn't works in Windoclient
            '--disable-gpu'
          ],
      }
});

 function deleteSession(){
    sessionData = null;
    if(fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlink(SESSION_FILE_PATH, function (err) {
            if (err) throw err;
            console.log('File deleted!');
        });
    }
}

//generating qr code    
var qrVar;
async function qrcode(req,res){
    res.send(qrVar).end();
}

client.on('qr',  async (qr) => {   
    qrVar = qr   
    app.get("/qrdata",qrcode)
});

client.on('authenticated', async (session) => {
        sessionData = session;
          fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
            if (err) {
                console.error(err);
            }
        });
});

client.on('ready', async() => {
const sqlQuery = "UPDATE whtsapp_status_master SET `whtsapp_status`='1' WHERE 1"
db.query(sqlQuery,(err,result)=>{
    console.log(result);
})

console.log("ClientReady");

});

client.initialize();

//send bulk messages
app.post("/send_msg", async (req,res)=>{ 

    const accessToken = req.body.accessToken;  
    const user_id = req.body.user_id; 
    const msg = req.body.msg1;
    const mobile_no= req.body.mobile_no;
    
    //checking access token
    var sqlQuery = "SELECT * FROM auth_master where accessToken='"+ accessToken +"'and user_id='"+ user_id +"'";
    
    db.query(sqlQuery,async(err,result,fields)=>{ 
     if(result.length>0){
         console.log(msg)
        
         var i ;
        
         for(i=0; i < mobile_no.length; i++){
              client.sendMessage(mobile_no[i], msg);
           }
     
         res.send("Messages_sent");  
     }
     else{
         res.send("Sorry Not authorised user");
         console.log("Sorry Not authorised user")
 
     }
 
     });
 });
 
 //send bulk contact cards
 app.post("/send_contact", async (req,res)=>{
 
     const accessToken = req.body.accessToken;  
     const user_id = req.body.user_id;  
     const mobile_no= req.body.mobile_no;
     const rec_contact = req.body.contact; 
 
     //checking access token
     var sqlQuery = "SELECT * FROM auth_master where accessToken='"+ accessToken +"'and user_id='"+ user_id +"'";
     console.log(accessToken,user_id,mobile_no,rec_contact);
     db.query(sqlQuery,async (err,result,fields)=>{ 
      if(result.length>0){           
        var i ;
        var counter2;
    
        for(i=0; i < mobile_no.length; i++){
            const contacts = [];
            for(counter2=0; counter2 < rec_contact.length; counter2++){
            contacts.push(await client.getContactById(rec_contact[counter2]));
           }
           await client.sendMessage(mobile_no[i], contacts);
          }
    
        res.send("Messages_sent"); 
      }
      else{
          res.send("Sorry Not authorised user");
          console.log("Sorry Not authorised user")
      }
  
      });
 });
 
 //send bulk images
 app.post("/send_img", upload.single('image'), (req, res) => {

    const accessToken = req.body.accessToken; 
    const user_id = req.body.user_id;  
    
    var sqlQuery = "SELECT * FROM auth_master where accessToken='"+ accessToken +"'and user_id='"+ user_id +"'";

    db.query(sqlQuery,async (err,result,fields)=>{ 
        if(result.length>0){           
            if (!req.file) {
                console.log("No file upload");
            }
            else {
                const img_name = req.file.filename;
                const mobile_no= req.body.mobile_no;
                const media = MessageMedia.fromFilePath(`images/${img_name}`);
   
                for(i=0; i < mobile_no.length; i++){
                  await client.sendMessage(mobile_no[i], media);
                }
                res.send("Messages_sent");
            } 
        }
        else{
            res.send("Sorry Not authorised user");
            console.log("Sorry Not authorised user")
        }
    
        });
 });

 app.post("/newSession", async (req,res)=>{

    const del_value = req.body.del_value;

    if(del_value==="delete"){
        sessionData = null;
        // if (typeof window !== 'undefined') {
        //     localStorage.clear();
        // }
        const sqlQuery = "UPDATE whtsapp_status_master SET `whtsapp_status`='0' WHERE 1"
        db.query(sqlQuery,(err,result)=>{
           console.log(result);
        });
        if (fs.existsSync(SESSION_FILE_PATH)) {
                fs.unlinkSync(SESSION_FILE_PATH);
        }

        client.destroy();
        client.initialize();
     }
});
    
// List of data for automatic reply
var msg_result;
async function dbreplies(message,sender_from){
   //console.log(message);
   const user_id = "9540552928";  

   var sqlQuery = "SELECT reply FROM reply_master where received='"+ message +"'and user_id='"+ user_id +"'"
   db.query(sqlQuery,(err,result,fields)=>{ 
    if(err){
      return "Sorry For Not Fund Any Answer";
    }else{
        if(result.length>0){
            msg_result= result[0].reply;
            console.log(msg_result);
             client.sendMessage(sender_from, msg_result);
             return msg_result; 
        }
    }
     
 });

}

client.on('message', async (message) => {

 dbreplies(message.body,message.from);
   
});

var port = process.env.port

app.listen(port||3002, () => {
    console.log('Server is running on PORT:3002');
  });


