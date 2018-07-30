var express = require("express");
var router = express.Router();
var User = require("../models/user");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var passport = require("passport");
var async = require("async");

var config = require("../../config"); //temporary

// HOME PAGE
router.get("/", function(request, response) {
    response.render("landing");
});


// NEW USER - show the form to create a new User
router.get("/register", function(request, response) {
    response.render("register", { page: 'register' });
});

// CREATE USER - add new user to dataBase
router.post("/register", function(request, response) {
    var newUser = new User({
        username: request.body.username,
        email: request.body.email
    });
    User.register(newUser, request.body.password, function(err, user) {
        if (err) {
            return response.render("register", { "error": err.message });
        }
        passport.authenticate("local")(request, response, function() {
            request.flash("info", "Welcome to Postcard Gallery, " + user.username + "!");
            response.redirect("/cards");
        });
    });
});

// LOGIN - Display login form
router.get("/login", function(request, response) {
    response.render("login", { page: 'login' });
});

// LOGIN - Handle login
router.post("/login", passport.authenticate("local", {
    successRedirect: "/cards",
    successFlash: "Welcome back!",
    failureRedirect: "/login",
    failureFlash: "Please submit a valid username and password"

}), function(request, response) {

});

// LOGOUT
router.get("/logout", function(request, response) {
    request.logout();
    request.flash("info", "No user is logged");
    response.redirect("/cards");
});

// FORGOT - Display forgot password form
router.get("/forgot", function(request, response) {
    response.render("forgot-pass");
});

// RESET - Send an emial with reset token to the user 
router.post("/forgot", function(request, response, next) {
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString("hex");
                done(err, token);
            });
        },
        function(token, done) {
            User.findOne({ email: request.body.email }, function(err, user) {
                if (!user) {
                    request.flash("error", "No account with that email address exists.");
                    return response.redirect("/forgot");
                }
                user.resetPassToken = token;
                user.resetPassExpires = Date.now() + 3600000; // 1 hour

                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },
        function(token, user, done) {
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                auth: {
                    type: "login", // default
                    user: config.email_to_notify,
                    pass: config.email_pass
                    // pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: "yuuyuuuki@gmail.com",
                subject: "Reset your password",
                text: "Dear " + user.username + "\n\n" +
                    "You recently asked to reset your password. To complete your request, please follow this link:\n\n " +
                    "http://" + request.headers.host + "/reset/" + token + "\n\n" +
                    "If you did not request this change, please ignore this email and your password will remail unchanged.\n"
            };
            transporter.sendMail(mailOptions, function(err) {
                console.log("email sent");
                if (err) { console.log("error is in first sendMail function") };
                request.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
                done(err, "done");
            });
        }
    ], function(err) {
        if (err) return next(err);
        response.redirect("/forgot");
    });
});

// RESET - Display submit new password form
router.get("/reset/:token", function(request, response) {
    console.log("I'm in RESET get route");
    User.findOne({ resetPassToken: request.params.token, resetPassExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
            request.flash("error", "Password reset token is invalid or has expired.");
            return response.redirect("/forgot");
        }
        response.render("reset-pass", { token: request.params.token });
    });
});

// RESET - Handle submission of the new password 
router.post("/reset/:token", function(request, response) {
    console.log("I'm in RESET post route");
    async.waterfall([
        function(done) {
            User.findOne({ resetPassToken: request.params.token, resetPassExpires: { $gt: Date.now() } }, function(err, user) {
                if (!user) {
                    request.flash("error", "Password reset token is invalid or has expired.");
                    return response.redirect("back");
                }
                if (request.body.password === request.body.password_2) {
                    user.setPassword(request.body.password, function(err) {
                        user.resetPassToken = undefined;
                        user.resetPassExpires = undefined;

                        user.save(function(err) {
                            request.logIn(user, function(err) {
                                done(err, user);
                            });
                        });
                    })
                }
                else {
                    request.flash("error", "Passwords do not match.");
                    return response.redirect("back");
                }
            });
        },
        function(user, done) {
            var transporter = nodemailer.createTransport({
                service: "Gmail",
                host: 'smtp.gmail.com',
                auth: {
                    type: "login", // default
                    user: "yuuyuuuki@gmail.com",
                    pass: "yukonpass123"
                    //  pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: "yuuyuuuki@gmail.com",
                subject: "Your password has been changed",
                text: "Dear " + user.username + "\n\n" +
                    "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
            };
            transporter.sendMail(mailOptions, function(err) {
                console.log("confirmation email sent");
                request.flash("success", "Your password has been changed!");
                done(err);
            });
        }
    ], function(err) {
        response.redirect("/cards");
    });
});

// 404 - Display error-page
router.get("/404", function(request, response) {
    response.render("404");
});

// 500 - Display error-page
router.get("/500", function(request, response) {
    response.render("500");
});


module.exports = router;
