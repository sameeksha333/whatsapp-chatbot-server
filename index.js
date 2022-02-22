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

client.on('qr', async (qr) => {
        const qrvar = qr;
        app.get("/qrdata", (req,res)=>{
            res.json(qrvar);
          });
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

app.post("/send_msg", async (req,res)=>{

    const msg = req.body.msg1;
    const mobile_no= req.body.mobile_no;
    console.log(msg)

    var i ;

    for(i=0; i < mobile_no.length; i++){
       await client.sendMessage(mobile_no[i], msg);
    //    const media = MessageMedia.fromFilePath('images/gaushala.jpeg');
    //    await client.sendMessage(mobile_no[i], media);
      }

      res.send("Messages_sent");

});

app.post("/send_contact", async (req,res)=>{

    const mobile_no= req.body.mobile_no;
    const rec_contact = ["919212552928@c.us","919540552928@c.us","917011353435@c.us"];
     //req.body.contact
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

});

app.post("/send_img", upload.single('image'), (req, res) => {

    if (!req.file) {
            console.log("No file upload");
        }
    else {
            const img_name = req.file.filename;
            //const mobile_no= req.body.mobile_no;
            const mobile_no= ["919212552928@c.us"];
            const media = MessageMedia.fromFilePath(`images/${img_name}`);
            //client.sendMessage("917011353435@c.us", media);
            for(i=0; i < mobile_no.length; i++){
                client.sendMessage(mobile_no[i], media);
            }
            res.send("Messages_sent");
        }
});

app.post("/custom_bulk_msg",(req,res)=>{
    const send_value = req.body.send_value;
    if(send_value==="send"){
        var data = [
            { id: 1, message: "Hello", mobile_no: "919212552928@c.us"},
            { id: 2, message: "Om namah Shivay", mobile_no: "919540552928@c.us"},
            { id: 3, message: "Can we have a call?", mobile_no: "917011353435@c.us"},
            ];
        const col_mobile = data.map(obj => obj["mobile_no"]);
        const col_messages = data.map(obj => obj["message"]);
     
        console.log(col_mobile); 
        var i ;
        var counter2;
    
        for(i=0; i < col_mobile.length; i++){
        //     const contacts = [];
        //     for(counter2=0; counter2 < rec_contact.length; counter2++){
        //     contacts.push(await client.getContactById(rec_contact[counter2]));
        //    }
           client.sendMessage(col_mobile[i], col_messages[i]);
        }
            // for(i=0; i < mobile_no.length; i++){
            //     client.sendMessage(mobile_no[i], media);
            // }
     res.json("messages send successfully")
    }
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
      
        setTimeout(function () {
            process.on("exit", function () {

              require("child_process")
                .spawn(
                  process.argv.shift(),
                  process.argv,
                  {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: "inherit"
                  }
                );

            });
            process.exit();
        }, 1000);
        //client.logout();
        //res.redirect('/restart');
        client.destroy();
        client.initialize();

        exec("npm run devStart", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
     }
    });
    app.get("/restart", (req, res)=>{
        setTimeout(function () {
            process.on("exit", function () {
              require("child_process")
                .spawn(
                  process.argv.shift(),
                  process.argv,
                  {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: "inherit"
                  }
                );

            });
            process.exit(1);
        }, 1000);
    })

    client.on('disconnected', async (reason) => {

        console.log("disconnected...", reason);

        //  sessionData = null;
        // if (fs.existsSync(SESSION_FILE_PATH)) {
        //         fs.unlinkSync(SESSION_FILE_PATH);
        // }
        const sqlQuery = "UPDATE whtsapp_status_master SET `whtsapp_status`='0' WHERE 1"
        db.query(sqlQuery,(err,result)=>{
           console.log(result);
        });
        //client.logout();
        client.destroy();
        client.initialize();
    });

// client.on('logout',(reason)=>{
//     console.log("logout...", reason);
//     client.destroy();
//     client.initialize();
// })

// List of data for automatic reply
var msg_result;
async function dbreplies(message,sender_from){
   //console.log(message);
   var sqlQuery = "SELECT reply FROM reply_master where received='"+ message +"'"
   db.query(sqlQuery, async (err,result,fields)=>{
    if(err){
      return "Sorry For Not Fund Any Answer";
    }else{
        if(result.length>0){
            msg_result= result[0].reply;
            client.sendMessage(sender_from, msg_result);
            const date  =  new Date().toISOString().slice(0, 10);
            const datetime = new Date().toTimeString();

            const query = "INSERT INTO `msg_history_master`(`msg_from`,`msg_detail`, `msg_date`, `msg_datetime`,`msg_type`) VALUES ('"+ sender_from +"','"+ msg_result +"','"+ date +"','"+ datetime +"','text')"
            db.query(query,(err,result,fields)=>{
                return result;
            })

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


