require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

// --------FUNCTIONS--------------

function convertMonth(x){
    if(x=="01") return "Jan";
    else if(x=="02") return "Feb";
    else if(x=="03") return "Mar";
    else if(x=="04") return "Apr";
    else if(x=="05") return "May";
    else if(x=="06") return "Jun";
    else if(x=="07") return "Jul";
    else if(x=="08") return "Aug";
    else if(x=="09") return "Sep";
    else if(x=="10") return "Oct";
    else if(x=="11") return "Nov";
    else if(x=="12") return "Dec";
}

function monthToIndex(x){
  if(x=="Jan") return "1";
  else if(x=="Feb") return "2";
  else if(x=="Mar") return "3";
  else if(x=="Apr") return "4";
  else if(x=="May") return "5";
  else if(x=="Jun") return "6";
  else if(x=="Jul") return "7";
  else if(x=="Aug") return "8";
  else if(x=="Sep") return "9";
  else if(x=="Oct") return "10";
  else if(x=="Nov") return "11";
  else if(x=="Dec") return "12";
}

function daysInMonth (month, year) {
  return new Date(year, month, 0).getDate();
}

// --------VARIABLES--------------

let userEmail,date,monthDate,yearDate,dayDate,yearPicker,monthPicker,dayToShow;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({
  extended: true
}));

// --------ESTABLISHING SESSION--------------

app.use(session({
  cookie:{
      secure: true,
      maxAge:60000
         },
  store: new RedisStore(),
  secret: 'secret',
  saveUninitialized: true,
  resave: false
  }));
  
  app.use(function(req,res,next){
    if(!req.session){
        return next(new Error('Oh no')) //handle error
    }
    next() //otherwise continue
    });

app.use(passport.initialize());
app.use(passport.session());

// --------CONNECTING WITH DATABASE AND CREATING SCHEMA--------------

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});

// mongoose.connect("mongodb://localhost:27017/balencevioDB", {useNewUrlParser: true});

const itemSchema = new mongoose.Schema ({
  username: String,
  categoryOftransaction:String,
  typeOfTransaction:String,
  amountOfTransaction:String,
  date:String,
  month:String,
  year:String,
  description:String
});

const reportSchema= new mongoose.Schema({
  username:String,
  date:String,
  veggies:Number,
  travel:Number,
  ration:Number,
  medicine:Number,
  others:Number,
  type:String
});

itemSchema.plugin(passportLocalMongoose);
itemSchema.plugin(findOrCreate);

reportSchema.plugin(passportLocalMongoose);
reportSchema.plugin(findOrCreate);

const Item = new mongoose.model("Item", itemSchema);

const Report=new mongoose.model("Report", reportSchema)

passport.use(Item.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  Item.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/dashboard",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    Item.findOrCreate({ username: profile._json.email}, function (err, user) {
      userEmail= profile._json.email;
      return cb(err, user);
    });
  }
));

// --------AUTHENTICATING GOOGLE LOGIN--------------

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile","email"] })
);

app.get("/auth/google/dashboard",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/dashboard");
});

// --------HOME ROUTE--------------

app.get("/", function(req, res){
  res.render("home");
});

// --------LOGIN ROUTE--------------

let msg="";

app.get("/login", function(req, res){
  res.render("login");
});

app.post("/login", function(req, res){

  const user = new Item({
    username: req.body.username,
    password: req.body.password
  });

  userEmail=req.body.username;

  req.login(user, function(err){
    if (err) {
      // console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/dashboard");
      });
    }
  });

});

// ---------------REGISTER ROUTE--------------

app.get("/register", function(req, res){
  res.render("register",{msg:msg});
  msg="";
});

app.post("/register", function(req, res){

  Item.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      msg="This Email Has A User Account";
      res.redirect("/register");
    } else {
      userEmail=req.body.username;
      passport.authenticate("local")(req, res, function(){
        res.redirect("/dashboard");
      });
    }
  });

});

// ---------------DASHBOARD ROUTE--------------

app.get("/dashboard", function(req, res){

  if (req.isAuthenticated()){
      Item.find({"amountOfTransaction":{$exists:true,$ne:"0"},"username":{$eq:userEmail}}, function(err, foundItems){
            if (err) {
              console.log(err);
            } else {
              let transactions=[],total=0,income=0,expense=0;
              foundItems.forEach(item=>{
                if(item.typeOfTransaction=="Income"){
                  income+=parseInt(item.amountOfTransaction);
                  total+=parseInt(item.amountOfTransaction);
                }else{
                  expense+=parseInt(item.amountOfTransaction);
                  total-=parseInt(item.amountOfTransaction);
                }
              })
              for(let i=foundItems.length-1,c=0;i>=0 && c<5;i--,c++){
                let transaction={
                  _id:foundItems[i]._id,
                  categoryOftransaction:foundItems[i].categoryOftransaction,
                  typeOfTransaction:foundItems[i].typeOfTransaction,
                  amountOfTransaction:foundItems[i].amountOfTransaction,
                  date:foundItems[i].date,
                  description:foundItems[i].description
                };
                transactions.push(transaction);
              }
              let index=0;
              res.render("dashboard",{transactions:transactions,expense:expense,income:income,total:total,index:index});
            }
      });
    } else {
      res.redirect("/login");
    }
});

// --------------NEW ENTRY ROUTE--------------

app.get("/newentry",function(req,res){
  if (req.isAuthenticated()){
      res.render("newentry");
    } else {
      res.redirect("/login");
    }
});

app.post("/newentry",function(req,res){
  if (req.isAuthenticated()){
      date=req.body.date;
      res.redirect("/addnew");
  } else {
      res.redirect("/login");
  }
});

// ---------------ADD NEW ROUTE--------------

app.get("/addnew",function(req,res){
  if (req.isAuthenticated()){
      monthDate=convertMonth(date.slice(5,7));
      yearDate=date.slice(0,4);
      dayDate=date.slice(8,10);
      date=dayDate+"/"+ monthDate+"/"+yearDate;
      res.render("addnew",{date:date});
  } else {
      res.redirect("/login");
  }
});

app.post("/addnew",function(req,res){
  if (req.isAuthenticated()){
      let items={
        veggies:String,
        travel:String,
        ration:String,
        medicine:String
      }

      Report.find({"username":{$eq:userEmail},"date":{$eq:date}},function(err,foundItems){
          if(err){
            console.log(err);
          }else{
            if(foundItems.length==0){
              const repoItem=new Report({
                username:userEmail,
                date:date,
                veggies:parseInt(req.body.veggies),
                travel:parseInt(req.body.travel),
                ration:parseInt(req.body.ration),
                medicine:parseInt(req.body.medicine),
                others:parseInt(req.body.amount),
                type:req.body.type
              });

              repoItem.save();
            }else{
              foundItems[0].veggies+=parseInt(req.body.veggies);
              foundItems[0].travel+=parseInt(req.body.travel);
              foundItems[0].medicine+=parseInt(req.body.medicine);
              foundItems[0].ration+=parseInt(req.body.ration);
              if(req.body.type=="Income"){
                foundItems[0].others+=parseInt(req.body.amount);
              }else{
                foundItems[0].others-=parseInt(req.body.amount);
              }
              foundItems[0].type=req.body.type;
            }
          }
      });

      for(var key in items) {
        if (items.hasOwnProperty(key)) {
          let category;
          Object.keys(req.body).map(reqKey => { 
            if (reqKey === key) 
            { 
              category=JSON.parse(req.body[reqKey]);
            }} );
          const item= new Item({
            username: userEmail,
            categoryOftransaction:key,
            typeOfTransaction:"Expense",
            amountOfTransaction:category,
            date:date,
            month:monthDate,
            year:yearDate,
            description:""
          });

          item.save();
        }
      }

      const item= new Item({
        username: userEmail,
        categoryOftransaction:"others",
        typeOfTransaction:req.body.type,
        amountOfTransaction:parseInt(req.body.amount),
        date:date,
        month:monthDate,
        year:yearDate,
        description:req.body.desc
      });

      item.save();

      res.redirect("/dashboard");

  } else {
      res.redirect("/login");
  }

});

// ---------------YEAR PICKER ROUTE--------------

app.get("/yearpicker",function(req,res){
  if (req.isAuthenticated()){
    res.render("yearpicker");
  } else {
    res.redirect("/login");
  }
});

app.post("/yearpicker",function(req,res){
  if (req.isAuthenticated()){
      yearPicker=req.body.year;
      Item.find({"amountOfTransaction":{$exists:true,$ne:"0"},"username":{$eq:userEmail},"year":{$eq:yearPicker}}, function(err, foundItems){
        if (err) {
          console.log(err);
        } else {
          let total=0,income=0,expense=0;
          foundItems.forEach(item=>{
            if(item.typeOfTransaction=="Income"){
              income+=parseInt(item.amountOfTransaction);
              total+=parseInt(item.amountOfTransaction);
            }else{
              expense+=parseInt(item.amountOfTransaction);
              total-=parseInt(item.amountOfTransaction);
            }
          })
          res.render("monthpicker",{expense:expense,income:income,total:total});
        }
      });
  } else {
      res.redirect("/login");
  }
});

// ---------------MONTH PICKER ROUTE--------------

app.post("/monthpicker",function(req,res){
  if (req.isAuthenticated()){
      monthPicker=req.body.month;
      res.redirect("/month-report")
  } else {
      res.redirect("/login");
  }
});

// ---------------MONTH REPORT ROUTE--------------

app.get("/month-report", function(req, res){
  if (req.isAuthenticated()){
      let monthIndex=parseInt(monthToIndex(monthPicker));
      let noOfDays=daysInMonth(monthIndex,yearPicker);
      let total=0,income=0,expense=0,monthYear=monthPicker+"-"+yearPicker;
      let monthlyReport=[],index=0;

            for(let i=1;i<=noOfDays;i++){
                let dateToBeCalculated="";
                if(i<10) dateToBeCalculated ="0";
                dateToBeCalculated +=i+"/"+monthPicker+"/"+yearPicker; 
                let veg=0,tr=0,ra=0,med=0,oth=0;
                Report.find({"username":{$eq:userEmail},"date":{$eq:dateToBeCalculated}}, function(err, foundItems){
                  if (err) {
                    console.log(err);
                  } else {    
                          veg=foundItems.length==0?0:String(foundItems[0].veggies);
                          tr=foundItems.length==0?0:String(foundItems[0].travel);
                          ra=foundItems.length==0?0:String(foundItems[0].ration);
                          med=foundItems.length==0?0:String(foundItems[0].medicine);
                          oth=foundItems.length==0?0:String(foundItems[0].others);
                          if(foundItems.length!==0){
                            expense+=(foundItems[0].veggies+foundItems[0].travel+foundItems[0].ration+foundItems[0].medicine);
                          total-=(foundItems[0].veggies+foundItems[0].travel+foundItems[0].ration+foundItems[0].medicine);
                            if(foundItems[0].type==="Income"){
                              income+=foundItems[0].others;
                              total+=foundItems[0].others;
                            }else{
                              expense+=foundItems[0].others;
                              total-=foundItems[0].others;
                            }
                          }
                    }
                });
                setTimeout(pushData,10000);
                function pushData(){
                    let dailyReport={
                      date:dateToBeCalculated,
                      veggies:veg,
                      travel:tr,
                      ration:ra,
                      medicine:med,
                      others:oth
                    };
                    // console.log(i);
                    monthlyReport.push(dailyReport);
                }
            }
      // calculate().then(_=>console.log(monthlyReport));
      setTimeout(function(){console.log(monthlyReport)},10000);
      // console.log(monthlyReport);
      setTimeout(function() {res.render("monthreport",{monthlyReport:monthlyReport,income:income,
      total:total,expense:expense,monthYear:monthYear,index:index})},
      10000);
  } else {
      res.redirect("/login");
  }
});

// ---------------SHOW SINGLE ENTRY ROUTE--------------

app.get("/show-single",function(req,res){
  if (req.isAuthenticated()){
      Item.find({"amountOfTransaction":{$exists:true,$ne:"0"},"username":{$eq:userEmail},"date":{$eq:dayToShow}}, function(err, foundItems){
        if (err) {
          console.log(err);
        } else {
          let transactions=[],total=0,income=0,expense=0;
              foundItems.forEach(item=>{
                if(item.typeOfTransaction=="Income"){
                  income+=parseInt(item.amountOfTransaction);
                  total+=parseInt(item.amountOfTransaction);
                }else{
                  expense+=parseInt(item.amountOfTransaction);
                  total-=parseInt(item.amountOfTransaction);
                }
              })
              for(let i=0;i<foundItems.length;i++){
                let transaction={
                  _id:foundItems[i]._id,
                  categoryOftransaction:foundItems[i].categoryOftransaction,
                  typeOfTransaction:foundItems[i].typeOfTransaction,
                  amountOfTransaction:foundItems[i].amountOfTransaction,
                  date:foundItems[i].date,
                  description:foundItems[i].description
                };
                transactions.push(transaction);
              }
              let index=0;
              res.render("showsingle",{transactions:transactions,expense:expense,income:income,total:total,index:index,date:dayToShow});
        }
      });
    } else {
      res.redirect("/login");
    }
});

app.post("/show-single",function(req,res){
  if (req.isAuthenticated()){
      dayToShow=req.body.date;
      res.redirect("/show-single")
  } else {
      res.redirect("/login");
  }
});

// ---------------LOGOUT ROUTE--------------

app.get("/logout", function(req, res){
  if (req.isAuthenticated()){
      req.logout();
      res.redirect("/");
  } else {
      res.redirect("/login");
  }
});

// ---------------DELETING ITEMS--------------

app.post("/delete-item",function(req,res){
  if (req.isAuthenticated()){
      Item.findByIdAndRemove(req.body.button,req.body,function(err,data){
        if(!err)
          res.redirect("/dashboard");
      });
  } else {
      res.redirect("/login");
  }
});

app.post("/delete-item-single",function(req,res){
  if (req.isAuthenticated()){
      Item.findByIdAndRemove(req.body.button,req.body,function(err,data){
        if(!err)
          res.redirect("/show-single");
      });
  } else {
      res.redirect("/login");
  }
});

app.listen(process.env.PORT || 3000, function() {
    console.log("Server started on port 3000.");
});