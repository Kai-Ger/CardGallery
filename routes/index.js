var express = require("express");
var router = express.Router();
var User = require("../models/user");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var passport = require("passport");
var async = require("async");

var config = require("../config");

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
    async.waterfall([
        function(callback) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString("hex");
                callback(err, token);
            });
        },
        function(token, callback) {
            if (request.body.introduction) {
                request.body.introduction = request.sanitize(request.body.introduction);
                request.body.introduction = request.body.introduction.replace(/(?:\r\n|\r|\n)/g, '<br>');
            }

            var newUser = new User({
                username: request.body.username,
                email: request.body.email,
                introduction: request.body.introduction,
                active: false,
                activateAccountToken: token
            });

            User.register(newUser, request.body.password, function(err, user) {
                if (err) {
                    console.log("err.message --->>>" + err.message);
                    if (err.message.includes("E11000")) {
                        return response.render("register", { "error": "This Email has already been registered" });
                    }
                    else {
                        return response.render("register", { "error": err.message });
                    }
                }
                else {
                    callback(err, user);
                }
            });
        },
        function(user, callback) {
            // send email with confirmation token 
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                auth: {
                    type: "login", // default
                    user: config.email_to_notify,
                    pass: config.email_pass
                }
            });
            var mailOptions = {
                to: user.email,
                from: config.email_to_notify,
                subject: "Welcome to CardGallery",
                text: "Dear " + user.username + "\n\n" +
                    "Thanks for joining CardGallery. To complete your registration, please follow this link:\n\n " +
                    "http://" + request.headers.host + "/register/" + user.activateAccountToken + "\n\n" +
                    "If you did not request this registration, please ignore this email.\n\n" +
                    "Thank you!"
            };
            transporter.sendMail(mailOptions, function(err) {
                console.log("email sent");
                if (err) {
                    console.log(err);
                    return response.render("someError");
                }
                else {
                    request.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
                    callback(err);
                }
            });
}
        ], function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            response.redirect("/cards");
        }
    });
});

// CREATE USER - confirm email via token
router.get("/register/:token", function(request, response) {
    console.log("Im in register - email confirmation - route");
    User.findOne({ activateAccountToken: request.params.token }, function(err, user) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            console.log("Im in else");
            if (!user) {
                request.flash("error", "Password reset token is invalid.");
                return response.redirect("/register");
            }
            user.active = true;
            user.activateAccountToken = 0;
            user.save();
            console.log("I just saved user data");
            response.redirect("/login");
        }
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
router.post("/forgot", function(request, response) {
    async.waterfall([
        function(callback) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString("hex");
                callback(err, token);
            });
        },
        function(token, callback) {
            User.findOne({ email: request.body.email }, function(err, user) {
                if (err) {
                    return callback(err);
                }
                if (!user) {
                    request.flash("error", "No account with that email address exists.");
                    return response.redirect("/forgot");
                }
                user.resetPassToken = token;
                user.resetPassExpires = Date.now() + 3600000; // 1 hour

                user.save(function(err) {
                    callback(err, token, user);
                });
            });
        },
        function(token, user, callback) {
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                auth: {
                    type: "login", // default
                    user: config.email_to_notify,
                    pass: config.email_pass
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
                callback(err, "done");
            });
        }
    ], function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            response.redirect("/forgot");
        }
    });
});

// RESET - Display submit new password form
router.get("/reset/:token", function(request, response) {
    console.log("I'm in RESET get route");
    User.findOne({ resetPassToken: request.params.token, resetPassExpires: { $gt: Date.now() } }, function(err, user) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            if (!user) {
                request.flash("error", "Password reset token is invalid or has expired.");
                return response.redirect("/forgot");
            }
            response.render("reset-pass", { token: request.params.token });
        }
    });
});

// RESET - Handle submission of the new password 
router.post("/reset/:token", function(request, response) {
    console.log("I'm in RESET post route");
    async.waterfall([
        function(callback) {
            User.findOne({ resetPassToken: request.params.token, resetPassExpires: { $gt: Date.now() } }, function(err, user) {
                if (err) {
                    return callback(err);
                }
                if (!user) {
                    request.flash("error", "Password reset token is invalid or has expired.");
                    return response.redirect("back");
                }
                if (request.body.password === request.body.password_2) {
                    user.setPassword(request.body.password, function(err) {
                        if (err) {
                            return callback(err);
                        }
                        user.resetPassToken = undefined;
                        user.resetPassExpires = undefined;

                        user.save(function(err) {
                            if (err) {
                                return callback(err);
                            }
                            request.logIn(user, function(err) {
                                callback(err, user);
                            });
                        });
                    });
                }
                else {
                    request.flash("error", "Passwords do not match.");
                    return response.redirect("back");
                }
            });
        },
        function(user, callback) {
            var transporter = nodemailer.createTransport({
                service: "Gmail",
                host: 'smtp.gmail.com',
                auth: {
                    type: "login", // default
                    user: config.email_to_notify,
                    pass: config.email_pass
                }
            });
            var mailOptions = {
                to: user.email,
                from: "yuuyuuuki@gmail.com",
                subject: "Your password has been changed",
                text: "Dear " + user.username + "\n\n" +
                    "This is a confirmation that the password for your account " + user.email + " has just been changed.\n",
                html: "Dear <strong>" + user.username + "</strong><br><br>" + "This is a confirmation that the password for your account " +
                    "<a href=" + request.headers.host + "/users/" + user._id + ">" + user.username + "</a> has just been changed.",
            };
            transporter.sendMail(mailOptions, function(err) {
                console.log("confirmation email sent");
                request.flash("success", "Your password has been changed!");
                callback(err);
            });
        }
    ], function(err) {
        if (err) {
            console.log(err);
            return response.render("someError");
        }
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
