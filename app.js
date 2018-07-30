var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    mothodOverride = require("method-override"),
    flash = require("connect-flash"),
    User = require("./models/user");

//  requiring routes
var cardRoutes = require("./routes/cards"),
    adminRoutes = require("./routes/admin_routes"),
    authRoutes = require("./routes/index");

mongoose.connect("mongodb://localhost:27017/cards", { useNewUrlParser: true });
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(mothodOverride("_method"));
app.use(flash());

// PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "temporary secret",
    saveUninitialized: false,
    resave: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(request, response, next) {
    response.locals.currentUser = request.user;
    response.locals.moment = require('moment');
    response.locals.success = request.flash("success");
    response.locals.error = request.flash("error");
    response.locals.info = request.flash("info");
    next();
});

// use routes
app.use(authRoutes);
app.use("/cards", cardRoutes);
app.use("/admin", adminRoutes);

// 404 error handling
app.use(function(request, response, next) {
    response.status(404).redirect("/404");
});

// 500 error handling
app.use(function(err, request, response, next) {
    console.error(err.stack);
    response.status(500).redirect("/500");
});

app.listen(process.env.PORT, process.env.IP, function() {
    console.log("Card Gallery server is up.");
});
